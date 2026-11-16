import Image from "next/image";

/** Use the original lettering, with ink selected for the surrounding surface. */
export function MedianeWordmark({
  height = 40,
  surface = "light",
  className = "",
}: {
  height?: number;
  surface?: "light" | "dark" | "auto";
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Mediane"
      className={`mediane-wordmark mediane-wordmark--${surface} ${className}`}
      style={{ height, width: (height * 2654) / 556 }}
    >
      {surface !== "dark" && (
        <Image
          src="/brand/mediane-wordmark-light.png"
          alt=""
          width={1400}
          height={293}
          loading="eager"
          unoptimized
          className="mediane-wordmark__light"
        />
      )}
      {surface !== "light" && (
        <Image
          src="/brand/mediane-wordmark-dark.png"
          alt=""
          width={1400}
          height={293}
          loading="eager"
          unoptimized
          className="mediane-wordmark__dark"
        />
      )}
    </span>
  );
}

/** The supplied blue icon for collapsed navigation and other square spaces. */
export function MedianeAppIcon({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/mediane-app-icon.png"
      alt="Mediane"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    />
  );
}

/** A small vector version keeps the road symbol crisp at utility-icon sizes. */
export function MedianeMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 60"
      fill="none"
      strokeWidth="3.4"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14.5 3 3 57M25.5 3 37 57" stroke="#1bbdda" />
      <path
        d="M20 4v10c0 4 3.5 6 3.5 10S16.5 30 16.5 35s3.5 6.5 3.5 10v11"
        stroke="#ef4f4c"
      />
    </svg>
  );
}
