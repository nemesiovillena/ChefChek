import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

const ConfirmationDialog = DialogPrimitive.Root
const ConfirmationDialogTrigger = DialogPrimitive.Trigger
const ConfirmationDialogPortal = DialogPrimitive.Portal
const ConfirmationDialogClose = DialogPrimitive.Close

const ConfirmationDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: 'destructive' | 'warning' | 'info'
    confirmButtonClassName?: string
    showDetails?: boolean
    details?: React.ReactNode
    onConfirm?: () => void
  }
>(({ className, children, title, description, confirmText = "Confirmar", cancelText = "Cancelar", variant = 'destructive', confirmButtonClassName, showDetails, details, onConfirm, ...props }, ref) => {
  const iconMap = {
    destructive: (
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
        <X className="w-6 h-6 text-red-600" />
      </div>
    ),
    warning: (
      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    ),
    info: (
      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
  }

  return (
    <ConfirmationDialogPortal>
      <ConfirmationDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        {...props}
      >
        <div className="flex flex-col items-center text-center">
          {iconMap[variant]}
          <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground mt-2 max-w-md">
            {description}
          </DialogPrimitive.Description>

          {showDetails && details && (
            <div className="mt-4 w-full">
              {details}
            </div>
          )}

          {children}
        </div>

        <div className="flex justify-center gap-3 mt-6">
          <ConfirmationDialogClose asChild>
            <Button variant="outline" className="w-28">
              {cancelText}
            </Button>
          </ConfirmationDialogClose>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            className={cn("w-28", confirmButtonClassName)}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </DialogPrimitive.Content>
    </ConfirmationDialogPortal>
  )
})
ConfirmationDialogContent.displayName = DialogPrimitive.Content.displayName

const ConfirmationDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
ConfirmationDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export { ConfirmationDialog, ConfirmationDialogContent, ConfirmationDialogTrigger, ConfirmationDialogClose }