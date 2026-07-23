from rq import SimpleWorker

from app.queue import ingestion_queue, redis_conn

# SimpleWorker runs jobs in-process instead of forking a subprocess per job --
# RQ's default Worker relies on os.fork(), which doesn't exist on Windows.
if __name__ == "__main__":
    SimpleWorker([ingestion_queue], connection=redis_conn).work()
