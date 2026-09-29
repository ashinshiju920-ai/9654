import { CheckCircle2, Info } from "lucide-react";

type ToastProps = {
  message: string;
  title: string;
  tone?: "info" | "success";
};

export function Toast({ message, title, tone = "info" }: ToastProps) {
  const Icon = tone === "success" ? CheckCircle2 : Info;

  return (
    <div className="ui-toast" role="status">
      <Icon size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
