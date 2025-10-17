import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center min-w-0">
          {index > 0 && <ChevronRight className="w-4 h-4 mx-2" />}
          {item.href || item.onClick ? (
            <button 
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                } else if (item.href) {
                  window.location.href = item.href;
                }
              }}
              className="hover:text-foreground transition-smooth cursor-pointer bg-transparent border-0 p-0 font-inherit text-inherit underline-offset-4 hover:underline break-words text-left"
            >
              {item.label}
            </button>
          ) : (
            <span className={index === items.length - 1 ? "text-foreground font-medium break-words" : "break-words"}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}