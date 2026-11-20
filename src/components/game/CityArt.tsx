"use client";

import type { GroupId } from "@/engine/types";

const INK = "#16142B";

export const REGION_LABELS: Record<GroupId, string> = {
  brown: "Aceh · Ujung Barat",
  lightblue: "Sumatera Utara & Riau",
  pink: "Sumatera Selatan",
  orange: "Jawa Barat & Tengah",
  red: "Mataram & Jawa Timur",
  yellow: "Bali & Nusa Tenggara",
  green: "Kalimantan & Sulawesi",
  darkblue: "Sulawesi Utara & Papua",
};

/**
 * Custom vector landmark & tile illustration for each of the 40 SerenityPoly board tiles.
 */
export function TileArtwork({ tileId, className = "h-full w-full" }: { tileId: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {renderTileSvg(tileId)}
    </svg>
  );
}

function renderTileSvg(id: number) {
  switch (id) {
    // 0: GO
    case 0:
      return (
        <g>
          <circle cx="32" cy="32" r="22" fill="#FFF4C7" stroke={INK} strokeWidth="2.5" />
          <path d="M22 46V18" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M22 18H44L39 25L44 32H22V18Z" fill="#FF5A3C" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M16 48H48" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M36 42L45 42L42 39M45 42L42 45" stroke="#2F5BFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    // 1: Sabang — Tugu Nol Kilometer
    case 1:
      return (
        <g>
          <path d="M10 50C18 46 26 46 32 50C38 54 46 54 54 50" stroke="#2F5BFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M26 48L29 22H35L38 48H26Z" fill="#FFF4C7" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="32" cy="17" r="5" fill="#FFD23F" stroke={INK} strokeWidth="2.5" />
          <path d="M20 48H44" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    // 2, 17, 33: Dana Umum (Bansos Gift)
    case 2:
    case 17:
    case 33:
      return (
        <g>
          <rect x="14" y="25" width="36" height="24" rx="5" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <rect x="11" y="19" width="42" height="9" rx="3" fill="#2FD592" stroke={INK} strokeWidth="2.5" />
          <rect x="28" y="19" width="8" height="30" fill="#FFD23F" stroke={INK} strokeWidth="2.2" />
          <path d="M32 19C26 11 19 14 23 19M32 19C38 11 45 14 41 19" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="#FF5A3C" />
        </g>
      );
    // 3: Banda Aceh — Kubah Baiturrahman
    case 3:
      return (
        <g>
          <rect x="14" y="34" width="36" height="16" rx="2" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <path d="M20 34C20 22 25 18 32 14C39 18 44 22 44 34Z" fill="#16142B" stroke={INK} strokeWidth="2.5" />
          <path d="M32 10V14" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M28 50V40C28 38 30 37 32 37C34 37 36 38 36 40V50" fill="#2FD592" stroke={INK} strokeWidth="2.2" />
          <rect x="11" y="28" width="5" height="22" rx="1.5" fill="#FFF4C7" stroke={INK} strokeWidth="2.2" />
          <rect x="48" y="28" width="5" height="22" rx="1.5" fill="#FFF4C7" stroke={INK} strokeWidth="2.2" />
        </g>
      );
    // 4: PBB (Tax)
    case 4:
    case 38:
      return (
        <g>
          <rect x="16" y="12" width="32" height="40" rx="5" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <path d="M23 22H41M23 29H37" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="38" cy="40" r="8" fill="#FFD23F" stroke={INK} strokeWidth="2.3" />
          <path d="M35 40H41M38 37V43" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
    // 5: TransJakarta Bus
    case 5:
      return (
        <g>
          <rect x="13" y="18" width="38" height="25" rx="6" fill="#2F5BFF" stroke={INK} strokeWidth="2.5" />
          <rect x="17" y="22" width="30" height="10" rx="2.5" fill="#DFE6FF" stroke={INK} strokeWidth="2" />
          <circle cx="21" cy="44" r="4.5" fill="#FFD23F" stroke={INK} strokeWidth="2.3" />
          <circle cx="43" cy="44" r="4.5" fill="#FFD23F" stroke={INK} strokeWidth="2.3" />
          <path d="M27 18V14H37V18" stroke={INK} strokeWidth="2.2" />
        </g>
      );
    // 6: Medan — Istana Maimun
    case 6:
      return (
        <g>
          <rect x="12" y="30" width="40" height="20" rx="2" fill="#FFD23F" stroke={INK} strokeWidth="2.5" />
          <path d="M10 30L22 21H42L54 30H10Z" fill="#FF5A3C" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M27 21C27 15 30 13 32 11C34 13 37 15 37 21Z" fill="#2FD592" stroke={INK} strokeWidth="2.2" />
          <path d="M28 50V39C28 36 36 36 36 39V50" fill="#FFFFFF" stroke={INK} strokeWidth="2.2" />
          <rect x="16" y="36" width="6" height="8" rx="1" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
          <rect x="42" y="36" width="6" height="8" rx="1" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
        </g>
      );
    // 7, 22, 36: Kesempatan
    case 7:
    case 22:
    case 36:
      return (
        <g>
          <rect x="17" y="13" width="30" height="38" rx="7" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" transform="rotate(-5 32 32)" />
          <path d="M27 25C27 21 37 21 37 26C37 30 32 30 32 34" stroke="#FF5A3C" strokeWidth="4" strokeLinecap="round" />
          <circle cx="32" cy="41" r="2.8" fill={INK} />
          <path d="M47 16L49 20L53 22L49 24L47 28L45 24L41 22L45 20Z" fill="#2F5BFF" stroke={INK} strokeWidth="1.6" />
        </g>
      );
    // 8: Padang — Atap Bagongjong Rumah Gadang
    case 8:
      return (
        <g>
          <rect x="16" y="34" width="32" height="16" rx="2" fill="#FFF4C7" stroke={INK} strokeWidth="2.5" />
          <path d="M10 22C18 32 25 32 32 23C39 32 46 32 54 22L49 35H15L10 22Z" fill="#FF5A3C" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="28" y="39" width="8" height="11" fill="#2F5BFF" stroke={INK} strokeWidth="2" />
        </g>
      );
    // 9: Pekanbaru — Menara & Sungai Siak
    case 9:
      return (
        <g>
          <path d="M14 48C22 44 42 44 50 48" stroke="#2F5BFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M22 44L26 22H38L42 44" fill="#DFE6FF" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M26 22L32 12L38 22H26Z" fill="#FFD23F" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="29" y="29" width="6" height="15" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
        </g>
      );
    // 10: Penjara
    case 10:
      return (
        <g>
          <rect x="15" y="15" width="34" height="34" rx="6" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <path d="M23 16V48M32 16V48M41 16V48" stroke={INK} strokeWidth="3" />
          <path d="M15 26H49M15 38H49" stroke={INK} strokeWidth="2.5" />
          <circle cx="32" cy="32" r="5" fill="#FF5A3C" stroke={INK} strokeWidth="2" />
        </g>
      );
    // 11: Palembang — Jembatan Ampera
    case 11:
      return (
        <g>
          <path d="M10 47H54" stroke="#2F5BFF" strokeWidth="3" strokeLinecap="round" />
          <rect x="18" y="18" width="7" height="29" fill="#FF5A3C" stroke={INK} strokeWidth="2.3" />
          <rect x="39" y="18" width="7" height="29" fill="#FF5A3C" stroke={INK} strokeWidth="2.3" />
          <path d="M18 24H46M12 37H52" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );
    // 12: PLN
    case 12:
      return (
        <g>
          <circle cx="32" cy="32" r="20" fill="#FFF4C7" stroke={INK} strokeWidth="2.5" />
          <path d="M35 15L22 34H32L29 49L42 30H32L35 15Z" fill="#FFD23F" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      );
    // 13: Bengkulu — Bunga Rafflesia
    case 13:
      return (
        <g>
          <circle cx="32" cy="21" r="8" fill="#FF5A3C" stroke={INK} strokeWidth="2.3" />
          <circle cx="21" cy="30" r="8" fill="#FF5A3C" stroke={INK} strokeWidth="2.3" />
          <circle cx="43" cy="30" r="8" fill="#FF5A3C" stroke={INK} strokeWidth="2.3" />
          <circle cx="25" cy="42" r="8" fill="#FF5A3C" stroke={INK} strokeWidth="2.3" />
          <circle cx="39" cy="42" r="8" fill="#FF5A3C" stroke={INK} strokeWidth="2.3" />
          <circle cx="32" cy="32" r="8" fill="#FFD23F" stroke={INK} strokeWidth="2.5" />
        </g>
      );
    // 14: Bandar Lampung — Menara Siger
    case 14:
      return (
        <g>
          <path d="M16 49H48L44 37H20L16 49Z" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <path d="M12 24C20 35 28 32 32 17C36 32 44 35 52 24L47 37H17L12 24Z" fill="#FFD23F" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="32" cy="15" r="3" fill="#FF5A3C" stroke={INK} strokeWidth="2" />
        </g>
      );
    // 15: KRL Commuter
    case 15:
      return (
        <g>
          <rect x="17" y="13" width="30" height="33" rx="8" fill="#FF5A3C" stroke={INK} strokeWidth="2.5" />
          <rect x="21" y="18" width="22" height="12" rx="3" fill="#DFE6FF" stroke={INK} strokeWidth="2" />
          <circle cx="24" cy="38" r="2.5" fill="#FFD23F" stroke={INK} strokeWidth="1.8" />
          <circle cx="40" cy="38" r="2.5" fill="#FFD23F" stroke={INK} strokeWidth="1.8" />
          <path d="M19 46L14 52M45 46L50 52M18 50H46" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    // 16: Bogor — Tugu Kujang & Daun Kebun Raya
    case 16:
      return (
        <g>
          <path d="M14 48C14 38 22 34 32 34C42 34 50 38 50 48Z" fill="#2FD592" stroke={INK} strokeWidth="2.5" />
          <path d="M27 44L30 18L36 14C38 21 37 26 34 30L37 44H27Z" fill="#FFD23F" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
        </g>
      );
    // 18: Bandung — Gedung Sate
    case 18:
      return (
        <g>
          <rect x="13" y="33" width="38" height="17" rx="2" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <path d="M19 33L25 25H39L45 33H19Z" fill="#2F5BFF" stroke={INK} strokeWidth="2.5" />
          <path d="M32 10V25" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="32" cy="14" r="2.5" fill="#FF5A3C" stroke={INK} strokeWidth="1.8" />
          <circle cx="32" cy="19" r="2.5" fill="#FFD23F" stroke={INK} strokeWidth="1.8" />
          <rect x="28" y="39" width="8" height="11" fill="#FFD23F" stroke={INK} strokeWidth="2" />
        </g>
      );
    // 19: Semarang — Lawang Sewu
    case 19:
      return (
        <g>
          <rect x="13" y="25" width="38" height="25" rx="2" fill="#FFF4C7" stroke={INK} strokeWidth="2.5" />
          <path d="M11 25L32 14L53 25H11Z" fill="#FF5A3C" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M19 50V36C19 33 23 33 23 36V50M30 50V36C30 33 34 33 34 36V50M41 50V36C41 33 45 33 45 36V50" fill="#2F5BFF" stroke={INK} strokeWidth="2" />
        </g>
      );
    // 20: Parkir Gratis
    case 20:
      return (
        <g>
          <rect x="14" y="14" width="36" height="36" rx="10" fill="#2F5BFF" stroke={INK} strokeWidth="2.5" />
          <path d="M25 42V22H34C39 22 41 25 41 28.5C41 32 39 35 34 35H25" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    // 21: Yogyakarta — Tugu Jogja
    case 21:
      return (
        <g>
          <rect x="20" y="42" width="24" height="8" rx="1.5" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <rect x="25" y="26" width="14" height="16" fill="#FFF4C7" stroke={INK} strokeWidth="2.5" />
          <path d="M28 26L32 11L36 26H28Z" fill="#FFD23F" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      );
    // 23: Solo — Mahkota & Batik Keraton
    case 23:
      return (
        <g>
          <rect x="14" y="34" width="36" height="16" rx="2" fill="#FFE4DD" stroke={INK} strokeWidth="2.5" />
          <path d="M12 34L22 22H42L52 34H12Z" fill="#2F5BFF" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M24 22L32 13L40 22" fill="#FFD23F" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M21 42H43" stroke={INK} strokeWidth="2.2" strokeDasharray="3 3" />
        </g>
      );
    // 24: Surabaya — Tugu Pahlawan & Gelombang
    case 24:
      return (
        <g>
          <path d="M12 46C20 42 28 50 36 46C44 42 48 46 52 46" stroke="#2F5BFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M27 44L32 12L37 44H27Z" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="22" cy="30" r="5" fill="#2FD592" stroke={INK} strokeWidth="2.2" />
          <circle cx="42" cy="30" r="5" fill="#FF5A3C" stroke={INK} strokeWidth="2.2" />
        </g>
      );
    // 25: MRT Jakarta
    case 25:
      return (
        <g>
          <rect x="13" y="20" width="38" height="22" rx="9" fill="#2FD592" stroke={INK} strokeWidth="2.5" />
          <rect x="18" y="24" width="28" height="10" rx="4" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
          <path d="M12 46H52" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <circle cx="22" cy="38" r="2.2" fill="#FFD23F" />
          <circle cx="42" cy="38" r="2.2" fill="#FFD23F" />
        </g>
      );
    // 26: Malang — Apel & Tugu Bundar
    case 26:
      return (
        <g>
          <circle cx="32" cy="35" r="14" fill="#FF5A3C" stroke={INK} strokeWidth="2.5" />
          <path d="M32 21C32 16 36 13 40 13" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M32 19C26 14 22 17 24 22C27 23 30 22 32 19Z" fill="#2FD592" stroke={INK} strokeWidth="2.2" />
          <circle cx="27" cy="31" r="2.5" fill="#FFE4DD" />
        </g>
      );
    // 27: Denpasar — Pura Bali
    case 27:
      return (
        <g>
          <path d="M22 49V23L16 23V49" fill="#FF5A3C" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M42 49V23L48 23V49" fill="#FF5A3C" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M14 23L22 13L27 23ZM37 23L42 13L50 23Z" fill="#FFD23F" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M12 49H52" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    // 28: PDAM
    case 28:
      return (
        <g>
          <circle cx="32" cy="32" r="20" fill="#DFE6FF" stroke={INK} strokeWidth="2.5" />
          <path d="M32 15C32 15 20 29 20 37C20 43.6 25.4 49 32 49C38.6 49 44 43.6 44 37C44 29 32 15 32 15Z" fill="#2F5BFF" stroke={INK} strokeWidth="2.5" />
          <path d="M27 38C27 41 29 43 32 43" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    // 29: Mataram — Lumbung Sasak
    case 29:
      return (
        <g>
          <rect x="20" y="38" width="24" height="12" fill="#FFF4C7" stroke={INK} strokeWidth="2.5" />
          <path d="M18 38C18 22 26 14 32 12C38 14 46 22 46 38H18Z" fill="#FFD23F" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="28" y="42" width="8" height="8" fill="#FF5A3C" stroke={INK} strokeWidth="2" />
        </g>
      );
    // 30: Masuk Penjara
    case 30:
      return (
        <g>
          <circle cx="32" cy="34" r="16" fill="#FF5A3C" stroke={INK} strokeWidth="2.5" />
          <path d="M25 34H39M32 27L39 34L32 41" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 15H42" stroke="#FFD23F" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    // 31: Balikpapan — Kilang & Pantai
    case 31:
      return (
        <g>
          <rect x="17" y="26" width="12" height="23" rx="2" fill="#DFE6FF" stroke={INK} strokeWidth="2.4" />
          <rect x="33" y="19" width="12" height="30" rx="2" fill="#2FD592" stroke={INK} strokeWidth="2.4" />
          <path d="M39 11V19M23 18V26" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="39" cy="11" r="2.5" fill="#FF5A3C" stroke={INK} strokeWidth="1.8" />
        </g>
      );
    // 32: Samarinda — Jembatan Mahakam
    case 32:
      return (
        <g>
          <path d="M10 46C18 42 46 42 54 46" stroke="#2F5BFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M14 40C20 20 44 20 50 40" stroke="#FFD23F" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M11 40H53M24 27V40M32 25V40M40 27V40" stroke={INK} strokeWidth="2.3" strokeLinecap="round" />
        </g>
      );
    // 34: Makassar — Kapal Phinisi
    case 34:
      return (
        <g>
          <path d="M13 42H51L45 50H19L13 42Z" fill="#FF5A3C" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M26 42V15L16 37H26Z" fill="#FFFFFF" stroke={INK} strokeWidth="2.3" strokeLinejoin="round" />
          <path d="M34 42V12L48 37H34Z" fill="#FFD23F" stroke={INK} strokeWidth="2.3" strokeLinejoin="round" />
        </g>
      );
    // 35: Kapal Pelni
    case 35:
      return (
        <g>
          <path d="M12 39H52L46 49H18L12 39Z" fill="#2F5BFF" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="20" y="25" width="24" height="14" rx="2" fill="#FFFFFF" stroke={INK} strokeWidth="2.4" />
          <rect x="27" y="16" width="10" height="9" fill="#FF5A3C" stroke={INK} strokeWidth="2.2" />
          <circle cx="27" cy="32" r="2" fill="#2F5BFF" />
          <circle cx="37" cy="32" r="2" fill="#2F5BFF" />
        </g>
      );
    // 37: Manado — Bunaken & Gunung Berapi
    case 37:
      return (
        <g>
          <path d="M12 45L29 17L35 17L52 45H12Z" fill="#2F5BFF" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M27 21L32 16L37 21" fill="#FFD23F" stroke={INK} strokeWidth="2" />
          <path d="M10 49C18 45 26 52 34 49C42 45 48 50 54 48" stroke="#2FD592" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    // 39: Jayapura — Cenderawasih & Jembatan Youtefa
    case 39:
      return (
        <g>
          <path d="M10 46H54" stroke="#2F5BFF" strokeWidth="3" strokeLinecap="round" />
          <path d="M15 44C21 20 43 20 49 44" stroke="#FF5A3C" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M25 27V44M32 25V44M39 27V44" stroke={INK} strokeWidth="2" />
          <circle cx="48" cy="17" r="5" fill="#FFD23F" stroke={INK} strokeWidth="2.2" />
        </g>
      );
    default:
      return (
        <g>
          <rect x="16" y="18" width="32" height="32" rx="6" fill="#DFE6FF" stroke={INK} strokeWidth="2.5" />
          <circle cx="32" cy="34" r="8" fill="#FFD23F" stroke={INK} strokeWidth="2.5" />
        </g>
      );
  }
}

export function BuildingBadge({ houses }: { houses: number }) {
  if (houses <= 0) return null;
  if (houses === 5) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full border-[1.5px] border-ink bg-tomato px-1.5 py-[1px] font-display text-[0.68em] font-extrabold leading-none text-white"
        title="Hotel"
      >
        ★ H
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-[2px] rounded-full border-[1.5px] border-ink bg-white px-1 py-[2px] leading-none"
      title={`${houses} rumah`}
    >
      {Array.from({ length: houses }).map((_, i) => (
        <span key={i} className="inline-block h-[0.55em] w-[0.55em] rounded-[2px] border border-ink bg-mint" />
      ))}
    </span>
  );
}
