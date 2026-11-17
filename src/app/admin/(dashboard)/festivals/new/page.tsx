import FestivalForm from "../FestivalForm";
import { createFestivalAction } from "@/app/actions/festival";

export default function NewFestivalPage() {
  return (
    <>
      <h1>Create Festival / Sale Event</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>
        Set up a new event with an animated homepage banner that auto-activates between the start and end dates.
      </p>
      <FestivalForm action={createFestivalAction} />
    </>
  );
}
