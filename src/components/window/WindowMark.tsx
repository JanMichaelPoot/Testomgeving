// The WindowInto brand icon — the mountain-and-window "V" mark, cropped
// from the user-supplied plaque photo (see public/logo/ for the full
// lockup this was cut from) with its background removed and the green
// recolored to this site's walnut accent family so it matches the
// "Warm Walnut" palette in src/app/globals.css.
//
// Every call site sits on either a light surface (cream/paper/surface-
// active) or a dark one (bg-accent-dark) — since the icon is now a fixed
// full-color image rather than a currentColor SVG, it can't adapt to its
// background automatically the way the old mark could. `onDark` switches
// to a flat cream cutout (icon-128-dark.png) for those dark surfaces;
// the default (icon-128.png) keeps the mountain's own walnut/gold color
// for light ones.
//
// A plain <img> rather than next/image: every call site sizes this purely
// via Tailwind height/width utility classes with no positioned wrapper,
// which next/image's `fill` mode would require adding everywhere.
/* eslint-disable @next/next/no-img-element */
export function WindowMark({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <img
      src={onDark ? "/logo/icon-128-dark.png" : "/logo/icon-128.png"}
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}
