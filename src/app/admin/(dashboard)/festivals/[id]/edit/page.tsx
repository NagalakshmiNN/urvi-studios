import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import FestivalForm from "../../FestivalForm";
import { updateFestivalAction } from "@/app/actions/festival";

export default async function EditFestivalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await db.query.festivalEvents.findFirst({
    where: eq(schema.festivalEvents.id, id),
  });

  if (!event) notFound();

  return (
    <>
      <h1>Edit: {event.name}</h1>
      <FestivalForm event={event} action={updateFestivalAction} />
    </>
  );
}
