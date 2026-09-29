import { cn } from "@/lib/design";

export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="aylem-loader" role="status">
      <span className="aylem-loader__dot aylem-loader__dot--ielts" />
      <span className="aylem-loader__dot aylem-loader__dot--oet" />
      <span className="aylem-loader__dot aylem-loader__dot--pte" />
      <span className="aylem-loader__dot aylem-loader__dot--german" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("ui-skeleton", className)} aria-hidden="true" />;
}
