// frontend/src/components/ui/card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Универсальный Card компонент с экспортом всех распространённых частей:
 * Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
 * Дополнительно: CardMedia, CardBody, CardExcerpt — удобные алиасы.
 */

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("card", className)} {...props} />;
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pb-2", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("card-title", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0 flex items-center", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

/* Convenience aliases matching earlier custom structure */
const CardMedia = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("card-media", className)} {...props} />
);

const CardBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("card-body", className)} {...props} />
);

const CardExcerpt = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("card-excerpt", className)} {...props} />
);

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardMedia,
  CardBody,
  CardExcerpt,
};

export default Card;
