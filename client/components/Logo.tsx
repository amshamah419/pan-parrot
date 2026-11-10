interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({
  className = "",
  showText = true,
  size = "md",
}: LogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <img src="/logo.webp" alt="PAN Parrot" className={sizeClasses[size]} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-bold text-foreground ${textSizeClasses[size]}`}
          >
            PAN Parrot
          </span>
        </div>
      )}
    </div>
  );
}
