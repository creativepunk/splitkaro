import { Metadata } from "next";
import { addContact } from "@/lib/actions/contacts";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Add Person" };

export default function AddPersonPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Add a Person</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Add someone by name for now. You can link their account later.
      </p>

      <form action={addContact} className="flex flex-col gap-5">
        <Input
          name="name"
          label="Name"
          placeholder="e.g. Alice, Bob, Mom…"
          required
          maxLength={80}
          autoFocus
        />
        <Button type="submit" size="lg" variant="primary">
          Add person
        </Button>
      </form>
    </div>
  );
}
