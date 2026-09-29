import { CircleHelp } from "lucide-react";

import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";

export default function SupportPage() {
  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Help & Support</p>
          <h1 className="page-title">Support</h1>
          <p className="page-subtitle">
            A clean support surface for student help, account questions and learning issues.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div>
            <Badge tone="navy">Support</Badge>
            <h2>Contact options</h2>
          </div>
          <CircleHelp size={22} color="#0AA69A" aria-hidden="true" />
        </CardHeader>
        <CardBody>
          <EmptyState
            title="Support workflow pending"
            message="Support links and contact routing will be added when operational details are confirmed."
          />
        </CardBody>
      </Card>
    </div>
  );
}
