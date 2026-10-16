import logging

from rq import SimpleWorker

from app.database import SessionLocal
from app.models.models import SavedItem
from app.queue import ingestion_queue, redis_conn

# This is a separate process from the uvicorn one (main.py), so it needs its
# own logging setup -- main.py's basicConfig() has no effect here. Without
# this, logger.info() calls anywhere in the ingestion pipeline are silently
# dropped (only warning()+ survives via logging's handler-of-last-resort).
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

logger = logging.getLogger(__name__)


def _recover_orphaned_jobs() -> None:
    """Marks any saved_items left stuck in "processing" as failed.

    A SimpleWorker handles one job at a time, synchronously, in-process --
    status only ever reads "processing" while that worker process is actively
    running the job. So at startup, any item still "processing" can only mean
    the previous worker process died mid-job (crash, OOM, redeploy) without
    reaching "ready" or "failed". Nothing else ever resets that status, so
    without this the item stays stuck forever and the UI shows it as
    perpetually in progress with no way to retry (the dedup-on-save check
    treats anything that isn't "failed" as already saved).
    """
    db = SessionLocal()
    try:
        stuck = db.query(SavedItem).filter(SavedItem.status == "processing").all()
        for item in stuck:
            item.status = "failed"
            item.failure_reason = "Processing was interrupted (server restart) -- please try saving this again."
        if stuck:
            db.commit()
            logger.warning("Recovered %d saved_item(s) orphaned by a previous worker crash/restart", len(stuck))
    finally:
        db.close()


# SimpleWorker runs jobs in-process instead of forking a subprocess per job --
# RQ's default Worker relies on os.fork(), which doesn't exist on Windows.
if __name__ == "__main__":
    _recover_orphaned_jobs()
    SimpleWorker([ingestion_queue], connection=redis_conn).work()
