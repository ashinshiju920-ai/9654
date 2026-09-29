import { User } from "lucide-react";

import { Badge, Card, CardBody, CardHeader, EmptyState, Input } from "@/components/ui";

export default function ProfilePage() {
  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Profile</p>
          <h1 className="page-title">Student profile</h1>
          <p className="page-subtitle">
            Profile settings will be connected to Supabase authentication in the auth phase.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div>
            <Badge tone="teal">Account</Badge>
            <h2>Profile details</h2>
          </div>
          <User size={22} color="#0AA69A" aria-hidden="true" />
        </CardHeader>
        <CardBody>
          <div className="stat-grid">
            <Input disabled label="Name" placeholder="Available after sign in" />
            <Input disabled label="Email" placeholder="Available after sign in" />
            <Input disabled label="Course focus" placeholder="Not selected" />
          </div>
          <EmptyState
            title="Authentication not connected"
            message="Editable profile controls will be enabled after Supabase auth is implemented."
          />
        </CardBody>
      </Card>
    </div>
  );
}
