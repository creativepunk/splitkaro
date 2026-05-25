import { cn, initials } from "@/lib/utils";
import Image from "next/image";

interface AvatarProps {
  name?: string | null;
  image?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizes = { xs: "h-6 w-6 text-xs", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base" };
const px = { xs: 24, sm: 32, md: 40, lg: 48 };

export function Avatar({ name, image, size = "md", className }: AvatarProps) {
  const dim = px[size];
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden bg-brand-100 dark:bg-brand-900 flex items-center justify-center font-semibold text-brand-700 dark:text-brand-300 select-none",
        sizes[size],
        className
      )}
    >
      {image ? (
        <Image src={image} alt={name ?? ""} width={dim} height={dim} className="object-cover w-full h-full" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

interface AvatarGroupProps {
  users: Array<{ id: string; name?: string | null; image?: string | null }>;
  max?: number;
  size?: AvatarProps["size"];
}

export function AvatarGroup({ users, max = 4, size = "sm" }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;
  return (
    <div className="flex -space-x-2">
      {visible.map((u) => (
        <Avatar key={u.id} name={u.name} image={u.image} size={size} className="ring-2 ring-white dark:ring-zinc-900" />
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 ring-2 ring-white dark:ring-zinc-900",
            sizes[size]
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
