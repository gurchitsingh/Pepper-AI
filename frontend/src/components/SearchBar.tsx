import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search your saves...", id }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className="w-full bg-surface border border-text-secondary/20 rounded-full pl-10 pr-10 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
