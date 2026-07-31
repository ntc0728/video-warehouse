import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { Icon } from "@/components/ui/Icon";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={`border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden transition-colors data-[state=open]:border-[var(--color-primary)] ${className ?? ''}`}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={`flex flex-1 items-center justify-between py-[var(--space-md)] px-[var(--space-lg)] font-medium transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] [&[data-state=open]>svg]:rotate-180 max-md:py-[var(--space-sm)] max-md:px-[var(--space-md)] ${className ?? ''}`}
      {...props}
    >
      {children}
      <Icon icon={ChevronDown} size="lg" className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform duration-300" style={{ transitionTimingFunction: 'var(--ease-spring)' }} />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = 'AccordionPrimitive.Trigger';

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={`pb-[var(--space-md)] pt-0 px-[var(--space-lg)] max-md:pb-[var(--space-sm)] max-md:px-[var(--space-md)] ${className ?? ''}`}>
      {children}
    </div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
