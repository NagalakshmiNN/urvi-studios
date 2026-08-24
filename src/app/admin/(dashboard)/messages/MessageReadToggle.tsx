"use client";

import { useTransition } from "react";
import { markMessageReadAction } from "@/app/actions/admin";

export default function MessageReadToggle({ messageId, status }: { messageId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const isRead = status === "READ";

  return (
    <button
      type="button"
      className="btn btn-outline btn-small"
      disabled={pending}
      onClick={() => startTransition(() => markMessageReadAction(messageId, isRead ? "NEW" : "READ"))}
    >
      {isRead ? "Mark as new" : "Mark as read"}
    </button>
  );
}
