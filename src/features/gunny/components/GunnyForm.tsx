"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type GunnyRecord } from "@/features/gunny/schemas";
import {
  createGunnySellerAction,
  createGunnyRecordAction,
  updateGunnyRecordAction,
} from "@/app/gunny/actions";

type GunnyFormProps = {
  initialData?: GunnyRecord;
  nextBillNo?: number;
  sellerOptions?: string[];
};

export function GunnyForm({ initialData, nextBillNo = 1, sellerOptions = [] }: GunnyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddingSeller, startAddSellerTransition] = useTransition();

  const [billNo, setBillNo] = useState<number>(initialData?.bill_no ?? nextBillNo);
  const [date, setDate] = useState<string>(
    initialData?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [seller, setSeller] = useState<string>(initialData?.seller ?? "");
  const [localSellerOptions, setLocalSellerOptions] = useState<string[]>(sellerOptions);
  const [bags, setBags] = useState<number>(initialData?.bags ?? 0);
  const [rate, setRate] = useState<number>(initialData?.rate ?? 0);
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const controlClassName = "h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100";

  const recalcAmount = (nextBags: number, nextRate: number) => {
    setAmount(Number((nextBags * nextRate).toFixed(2)));
  };

  const onAddSeller = () => {
    startAddSellerTransition(async () => {
      try {
        const name = seller.trim();
        if (!name) {
          toast.error("Enter seller name first");
          return;
        }
        const created = await createGunnySellerAction({ name, place: "", mob: "" });
        setSeller(created.name);
        setLocalSellerOptions((current) =>
          current.includes(created.name) ? current : [...current, created.name],
        );
        toast.success("Seller added");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to add seller");
      }
    });
  };

  const onSubmit = () => {
    startTransition(async () => {
      try {
        const payload = {
          bill_no: Number(billNo),
          date,
          seller,
          bags: Number(bags),
          rate: Number(rate),
          amount: Number(amount),
          paid_amount: 0,
          payment_mode: "none",
          upi_number: "",
          rtgs_name: "",
          note: "",
          source: "app",
        };

        if (initialData) {
          await updateGunnyRecordAction(initialData.id, payload);
          toast.success("Gunny record updated");
        } else {
          await createGunnyRecordAction(payload);
          toast.success("Gunny record added");
        }

        router.replace("/gunny");
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to save record");
      }
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-[#252932] bg-[#111214] p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm text-zinc-400">
          Bill No
          <Input type="number" min={1} value={billNo} onChange={(e) => setBillNo(Number(e.target.value))} className={controlClassName} />
        </label>
        <label className="space-y-1 text-sm text-zinc-400">
          Date
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={controlClassName} />
        </label>
        <label className="space-y-1 text-sm text-zinc-400 md:col-span-2">
          Seller Name
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                value={seller}
                list="gunny-seller-options"
                placeholder="Search existing seller or type"
                onChange={(e) => setSeller(e.target.value)}
                className={`${controlClassName} flex-1`}
              />
              <Button
                type="button"
                onClick={onAddSeller}
                disabled={isAddingSeller}
                className="h-10 min-w-[88px] border border-[#2a2d34] bg-[#1b1e24] px-4 text-zinc-100 hover:bg-[#23262e] whitespace-nowrap"
              >
                {isAddingSeller ? "Adding..." : "Add"}
              </Button>
            </div>
            <datalist id="gunny-seller-options">
              {localSellerOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
        </label>
        <label className="space-y-1 text-sm text-zinc-400">
          Bags
          <Input
            type="number"
            min={0}
            placeholder="Enter bags"
            value={bags === 0 ? "" : bags}
            onChange={(e) => {
              const next = Number(e.target.value) || 0;
              setBags(next);
              recalcAmount(next, rate);
            }}
            className={controlClassName}
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-400">
          Rate
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Enter rate"
            value={rate === 0 ? "" : rate}
            onChange={(e) => {
              const next = Number(e.target.value) || 0;
              setRate(next);
              recalcAmount(bags, next);
            }}
            className={controlClassName}
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-400">
          Amount
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Enter amount"
            value={amount === 0 ? "" : amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className={controlClassName}
          />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.replace("/gunny")} className="h-10 border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e]">Cancel</Button>
        <Button type="button" onClick={onSubmit} disabled={isPending} className="h-10 border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]">
          {isPending ? "Saving..." : initialData ? "Update" : "Save"}
        </Button>
      </div>
    </div>
  );
}
