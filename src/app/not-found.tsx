import { ErrorState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="page">
      <ErrorState
        actionHref="/"
        actionLabel="Back to dashboard"
        title="Page not found"
        message="The requested portal page does not exist."
      />
    </div>
  );
}
