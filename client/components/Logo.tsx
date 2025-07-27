interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className = "", showText = true, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <img 
        src="https://cdn.builder.io/api/v1/image/assets%2F729a06a633f44e10a9a65881ed017eaa%2F7199dc370d1d4e4ca7ca839ff2e13aae?format=webp&width=800" 
        alt="PAN Parrot"
        className={sizeClasses[size]}
      />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-bold text-foreground ${textSizeClasses[size]}`}>
            PAN Parrot
          </span>
        </div>
      )}
    </div>
  );
}
