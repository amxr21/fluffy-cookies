"use client";

import { useEffect, useState } from "react";

import { Container } from "@/components/ui/Container";
import { MenuCard } from "@/components/ui/MenuCard";
import { StatusState } from "@/components/ui/StatusState";
import { SkeletonCard, SkeletonGroup } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { getJSON, type Paginated } from "@/lib/safeFetch";
import type { MenuItem } from "@/lib/menu";

export default function LikedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [state, setState] = useState<
    "loading" | "ready" | "error" | "forbidden"
  >("loading");

  useEffect(() => {
    if (!user) {
      setState("ready");
      return;
    }
    let active = true;
    (async () => {
      const res = await getJSON<Paginated<MenuItem>>(`/likes/${user.userId}`);
      if (!active) return;
      if (res.ok && Array.isArray(res.data?.data)) {
        setItems(res.data.data);
        setState("ready");
      } else if (res.status === 403) {
        // Someone else's id in the URL. A different answer from "it broke".
        setState("forbidden");
      } else {
        setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <main className="flex-1">
      <Container className="py-16 md:py-24">
        <h1 className="mb-8 text-center text-h2 uppercase text-navy">Liked Items</h1>

        {!user ? (
          <StatusState
            variant="empty"
            title="Sign in to see your liked items"
            message="Save your favorite treats and find them all here."
          />
        ) : state === "loading" ? (
          <SkeletonGroup
            label="Loading your liked items"
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </SkeletonGroup>
        ) : state === "forbidden" ? (
          <StatusState
            variant="unauthorized"
            title="That's not your account"
            message="You can only see your own liked items."
            cta={{ label: "Back home", href: "/" }}
          />
        ) : state === "error" ? (
          <StatusState
            variant="error"
            title="Couldn't load your liked items"
            message="Please try again in a moment."
            cta={{ label: "Reload", href: "/liked" }}
          />
        ) : items.length === 0 ? (
          <StatusState
            variant="empty"
            title="No liked items yet"
            message="Tap the heart on a treat to save it here."
            cta={{ label: "Browse the Menu", href: "/menu" }}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <MenuCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
