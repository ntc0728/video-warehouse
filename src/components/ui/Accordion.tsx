import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, children, className = '', disabled = false }, ref) => {
    return (
      <AccordionPrimitive.Item
        ref={ref}
        value={value}
        disabled={disabled}
        className={['settings-accordion__item', className].join(' ')}
      >
        {children}
      </AccordionPrimitive.Item>
    );
  }
);

AccordionItem.displayName = 'AccordionItem';

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ children, className = '' }, ref) => {
    return (
      <AccordionPrimitive.Header asChild>
        <h3>
          <AccordionPrimitive.Trigger
            ref={ref}
            className={['settings-accordion__trigger', className].join(' ')}
          >
            {children}
            <span className="settings-accordion__icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </AccordionPrimitive.Trigger>
        </h3>
      </AccordionPrimitive.Header>
    );
  }
);

AccordionTrigger.displayName = 'AccordionTrigger';

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ children, className = '' }, ref) => {
    return (
      <AccordionPrimitive.Content
        ref={ref}
        className={['settings-accordion__content', className].join(' ')}
      >
        <div className="settings-accordion__content-inner">
          {children}
        </div>
      </AccordionPrimitive.Content>
    );
  }
);

AccordionContent.displayName = 'AccordionContent';

export { AccordionItem, AccordionTrigger, AccordionContent };
