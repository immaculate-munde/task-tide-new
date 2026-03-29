"use client";

import CalendarApp from "../../../components/CalendarApp";
import { useAppContext } from "@/hooks/useAppContext";

export default function CalendarPage() {
  const { currentUser } = useAppContext();

  return (
    <main>
      <CalendarApp
        currentUserId={currentUser ? String(currentUser.id) : undefined}
        userRole={currentUser?.role}
      />
    </main>
  );
}
