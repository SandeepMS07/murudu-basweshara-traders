"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Inter } from "next/font/google";
import {
  ArrowRight,
  Truck,
  ShoppingCart,
  Sprout,
  BadgeIndianRupee,
  ShieldCheck,
  Clock,
  Phone,
  Mail,
  MapPin,
  Menu,
  X,
} from "lucide-react";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const CONTACT_EMAIL = "info@mbgroups.example";
const CONTACT_PHONE = "+91 98765 43210";
const CONTACT_ADDRESS = "Plot 12, Market Yard Road, Hyderabad, Telangana 500001";

const ACCENT = "#ff6a3d";

const services = [
  {
    icon: ShoppingCart,
    title: "We buy dry maize",
    desc: "Direct procurement of quality dry maize from farmers and suppliers at fair, competitive rates.",
  },
  {
    icon: Sprout,
    title: "We sell dry maize",
    desc: "Reliable bulk supply of dry maize grain to poultry feed, starch, and food industries.",
  },
  {
    icon: BadgeIndianRupee,
    title: "The best price",
    desc: "As your trusted trade partner, we secure the right price on both sides of every deal.",
  },
  {
    icon: Truck,
    title: "On-time delivery",
    desc: "Dependable logistics that get your maize where it needs to be, right on schedule.",
  },
];

const stats = [
  { value: "20+", label: "Years in the maize trade" },
  { value: "500+", label: "Suppliers & buyers" },
  { value: "50k+", label: "Tonnes traded" },
  { value: "Best", label: "Market rates" },
];

const whyUs = [
  {
    icon: BadgeIndianRupee,
    title: "The right price",
    desc: "As the link between farmers and industry, we get sellers a fair rate and buyers a great deal.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted partner",
    desc: "Honest dealing and clear settlements have kept our suppliers and buyers with us for years.",
  },
  {
    icon: Clock,
    title: "On-time, every time",
    desc: "Steady volumes and dependable logistics keep your maize moving without delays.",
  },
];

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });

  const handleEnquiry = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Enquiry from ${form.name || "website"}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nPhone: ${form.phone}\n\n${form.message}`,
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const navLinks = [
    { href: "#services", label: "What we do" },
    { href: "#why", label: "Why us" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <div className={`${inter.className} min-h-screen bg-[#0b0b0d] text-zinc-100 antialiased`}>
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[#1d1f24] bg-[#0b0b0d]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="rounded-xl border border-[#2a2d34] bg-[#101218] p-1.5">
              <Image
                src="/brand/mb-logo-mark.png"
                alt="MB Groups"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
            </span>
            <span className="text-lg font-semibold tracking-tight">MB Groups</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#contact"
              className="rounded-lg border border-[#2a2d34] bg-[#15171c] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-[#3a3d44] hover:text-white"
            >
              Get in touch
            </a>
          </nav>

          <button
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-[#1d1f24] bg-[#0b0b0d] px-6 py-4 md:hidden">
            <nav className="flex flex-col gap-4">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-zinc-300 hover:text-white"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg border border-[#2a2d34] bg-[#15171c] px-4 py-2 text-center text-sm font-medium"
              >
                Get in touch
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#1d1f24] bg-[#0f1013]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(70% 55% at 75% 15%, ${ACCENT}22 0%, rgba(15,16,19,0) 60%)`,
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:py-28 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2a2d34] bg-[#101218] px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400"
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
              Maize · Buy · Sell
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
              We buy and sell dry maize at the{" "}
              <span style={{ color: ACCENT }}>right price</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
              MB Groups is your trusted dry maize trading partner — connecting farmers and suppliers
              with buyers across the industry, and making sure everyone gets a fair deal.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110"
                style={{ backgroundColor: ACCENT, boxShadow: `0 10px 30px -10px ${ACCENT}80` }}
              >
                Enquire now <ArrowRight className="size-4" />
              </a>
              <a
                href="#services"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2a2d34] bg-[#15171c] px-6 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-[#3a3d44] hover:text-white"
              >
                What we do
              </a>
            </div>
          </div>

          <div className="relative h-[360px] md:h-[480px]">
            {/* main photo: dried maize kernels in trader's hands */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl border border-[#1d1f24] shadow-2xl">
              <Image
                src="/marketing/dry-maize-hands.webp"
                alt="Hands holding dry yellow maize grain over a heap of kernels"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
                priority
              />
              {/* warm the photo and blend it into the dark theme */}
              <div className="absolute inset-0 bg-[#ff6a3d]/10 mix-blend-multiply" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f1013]/75 via-transparent to-[#0f1013]/30" />
            </div>

            {/* smaller overlapping photo: dried maize cobs */}
            <div className="absolute -bottom-6 -left-6 hidden h-40 w-40 overflow-hidden rounded-2xl border-2 border-[#1d1f24] shadow-xl md:block lg:h-48 lg:w-48">
              <Image
                src="/marketing/maize-pile.webp"
                alt="Heap of dried yellow maize cobs"
                fill
                sizes="200px"
                className="object-cover"
              />
            </div>

            {/* floating badge */}
            <div className="absolute right-4 top-4 flex items-center gap-2.5 rounded-xl border border-[#2a2d34] bg-[#0b0b0d]/85 px-4 py-2.5 backdrop-blur">
              <span
                className="flex size-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}
              >
                <Sprout className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-white">Dry Yellow Maize</div>
                <div className="text-xs text-zinc-400">Clean, graded & bulk-ready</div>
              </div>
            </div>

            {/* orange glow under the panel */}
            <div className="pointer-events-none absolute -bottom-8 left-1/2 h-16 w-72 -translate-x-1/2 rounded-full bg-[#ff6a3d]/20 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-[#1d1f24] bg-[#0b0b0d]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-none md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-6 py-12 text-center ${i !== 0 ? "border-l border-[#1d1f24]" : ""} ${
                i >= 2 ? "border-t md:border-t-0" : ""
              } border-[#1d1f24]`}
            >
              <div className="text-3xl font-semibold text-white md:text-4xl">{s.value}</div>
              <div className="mt-2 text-sm text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: ACCENT }}
          >
            What we do
          </p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            A straightforward dry maize trade
          </h2>
          <p className="mt-4 text-zinc-400">
            We buy from those who grow it and sell to those who need it — at a price that works
            for both sides.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div
              key={s.title}
              className="group rounded-2xl border border-[#2a2d34] bg-[#101218] p-7 transition-colors hover:border-[#ff6a3d]/50"
            >
              <div className="flex size-12 items-center justify-center rounded-xl border border-[#2a2d34] bg-[#15171c] text-zinc-300">
                <s.icon className="size-5 transition-colors group-hover:text-[#ff6a3d]" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section id="why" className="border-y border-[#1d1f24] bg-[#0f1013]">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: ACCENT }}
              >
                Why us
              </p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Why partners choose MB Groups
              </h2>
              <p className="mt-4 text-zinc-400">
                With years in the maize trade, we know the market. Whether you grow maize or buy
                it in bulk, we make sure you get a fair price and a dependable partner.
              </p>
              <a
                href="#contact"
                className="mt-8 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{ backgroundColor: ACCENT, boxShadow: `0 10px 30px -10px ${ACCENT}80` }}
              >
                Talk to our team <ArrowRight className="size-4" />
              </a>
            </div>
            <div className="grid gap-5">
              {whyUs.map((w) => (
                <div
                  key={w.title}
                  className="flex gap-4 rounded-2xl border border-[#2a2d34] bg-[#101218] p-6"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#2a2d34] bg-[#15171c]">
                    <w.icon className="size-5" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{w.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: ACCENT }}
            >
              Contact
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Get in touch</h2>
            <p className="mt-4 text-zinc-400">
              Want to sell your dry maize or need a reliable bulk supply? Send us an enquiry and our team
              will get back to you with the best rate.
            </p>

            <div className="mt-10 space-y-4">
              <a
                href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}
                className="flex items-center gap-4 rounded-xl border border-[#2a2d34] bg-[#101218] px-5 py-4 text-zinc-300 transition-colors hover:border-[#3a3d44] hover:text-white"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-lg border border-[#2a2d34] bg-[#15171c]"
                  style={{ color: ACCENT }}
                >
                  <Phone className="size-4" />
                </span>
                {CONTACT_PHONE}
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-4 rounded-xl border border-[#2a2d34] bg-[#101218] px-5 py-4 text-zinc-300 transition-colors hover:border-[#3a3d44] hover:text-white"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-lg border border-[#2a2d34] bg-[#15171c]"
                  style={{ color: ACCENT }}
                >
                  <Mail className="size-4" />
                </span>
                {CONTACT_EMAIL}
              </a>
              <div className="flex items-start gap-4 rounded-xl border border-[#2a2d34] bg-[#101218] px-5 py-4 text-zinc-300">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#2a2d34] bg-[#15171c]"
                  style={{ color: ACCENT }}
                >
                  <MapPin className="size-4" />
                </span>
                <span className="pt-2">{CONTACT_ADDRESS}</span>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleEnquiry}
            className="rounded-2xl border border-[#2a2d34] bg-[#101218] p-7"
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-400">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-[#2a2d34] bg-[#0b0b0d] px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#ff6a3d]"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-400">Phone</label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-[#2a2d34] bg-[#0b0b0d] px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#ff6a3d]"
                  placeholder="Your phone number"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-400">Message</label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-[#2a2d34] bg-[#0b0b0d] px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#ff6a3d]"
                  placeholder="Tell us how much maize you want to buy or sell"
                />
              </div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{ backgroundColor: ACCENT, boxShadow: `0 10px 30px -12px ${ACCENT}80` }}
              >
                Send enquiry <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1d1f24] bg-[#0b0b0d]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/mb-logo-mark.png"
              alt="MB Groups"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
            <span className="text-sm font-medium text-zinc-300">MB Groups</span>
          </div>
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} MB Groups. All rights reserved.
          </p>
          <Link href="/login" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Staff login →
          </Link>
        </div>
      </footer>
    </div>
  );
}
