import { User } from "lucide-react";

import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { requireUserOrRedirect } from "@/lib/auth";
import { ProfileEditor } from "./profile-editor";

export default async function ProfilePage() {
  const user = await requireUserOrRedirect("/signup?next=/profile");

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Profile</p>
          <h1 className="page-title">Student profile</h1>
          <p className="page-subtitle">
            Manage your personal details and account settings.
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
          <ProfileEditor
            initialEmail={user.email}
            initialFullName={user.fullName}
            role={user.role}
            accountStatus={user.accountStatus}
          />
        </CardBody>
      </Card>
    </div>
  );
}
