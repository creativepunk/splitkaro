import { Metadata } from "next";
import { createGroup } from "@/lib/actions/groups";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "New Group" };

const EMOJIS = ["👥", "✈️", "🏕️", "🎉", "🏠", "🍕", "🚗", "🎮", "🏖️", "🎵"];

export default function NewGroupPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">New Group</h1>
      <p className="text-sm text-zinc-500 mb-8">Name your group and pick an emoji.</p>

      <form action={createGroup} className="flex flex-col gap-6">
        {/* Emoji picker */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon</label>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e, i) => (
              <label key={e} className="cursor-pointer">
                <input
                  type="radio"
                  name="emoji"
                  value={e}
                  defaultChecked={i === 0}
                  className="sr-only peer"
                />
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-xl peer-checked:border-brand-500 peer-checked:bg-brand-50 dark:peer-checked:bg-brand-950 transition-colors">
                  {e}
                </span>
              </label>
            ))}
          </div>
        </div>

        <Input name="name" label="Group name" placeholder="e.g. Chicago Trip Squad" required maxLength={80} />

        <Button type="submit" size="lg" variant="primary">
          Create group
        </Button>
      </form>
    </div>
  );
}
