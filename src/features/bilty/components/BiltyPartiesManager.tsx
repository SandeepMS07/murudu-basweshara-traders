"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type BiltyParty } from "@/features/bilty/schemas";
import {
  createBiltyPartyAction,
  deleteBiltyPartyAction,
} from "@/app/bilty/actions";

interface BiltyPartiesManagerProps {
  parties: BiltyParty[];
}

export function BiltyPartiesManager({ parties }: BiltyPartiesManagerProps) {
  const [data, setData] = useState(parties);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const normalizedQuery = draft.trim().toLowerCase();
  const filteredParties = useMemo(
    () =>
      normalizedQuery
        ? data.filter((party) => party.name.toLowerCase().includes(normalizedQuery))
        : data,
    [data, normalizedQuery]
  );

  const handleAdd = () => {
    const value = draft.trim();
    if (!value) {
      toast.error("Enter a party name");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createBiltyPartyAction(value);
        setData((current) => {
          const existingIndex = current.findIndex(
            (party) => party.id === created.id || party.name === created.name
          );
          if (existingIndex >= 0) {
            const next = [...current];
            next[existingIndex] = created;
            return next;
          }
          return [...current, created].sort((a, b) => a.name.localeCompare(b.name));
        });
        setDraft("");
        toast.success("Party saved");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to save party");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteBiltyPartyAction(id);
        setData((current) => current.filter((party) => party.id !== id));
        toast.success("Party deleted");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete party");
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
        <CardHeader>
          <CardTitle className="text-zinc-100">Add Party</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a new party name"
            className="h-11 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500"
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="h-11 border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28] sm:w-40"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Party"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[#1f2229] bg-[#111214] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
        <CardHeader className="border-b border-[#252932]">
          <CardTitle className="text-zinc-100">
            Parties
            <span className="ml-2 text-sm font-normal text-zinc-500">
              ({filteredParties.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[#252932]">
            {filteredParties.length > 0 ? (
              filteredParties.map((party) => (
                <div
                  key={party.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{party.name}</p>
                    <p className="text-xs text-zinc-500">Available for bilty search</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(party.id)}
                    disabled={isPending}
                    title="Delete party"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-zinc-500">
                No parties found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
