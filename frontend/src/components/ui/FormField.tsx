import {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, required, error, hint, children, className = '' }: FormFieldProps) {
  return (
    <div className={`form-field ${className}`.trim()}>
      <label className="form-label">
        {label}
        {required && <span className="required-star">*</span>}
      </label>
      {children}
      {error && <div className="form-error">{error}</div>}
      {!error && hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError, className = '', ...rest }: InputProps) {
  return <input className={`form-input ${hasError ? 'has-error' : ''} ${className}`.trim()} {...rest} />;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function Select({ hasError, className = '', children, ...rest }: SelectProps) {
  return (
    <select className={`form-select ${hasError ? 'has-error' : ''} ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export function Textarea({ hasError, className = '', ...rest }: TextareaProps) {
  return (
    <textarea className={`form-textarea ${hasError ? 'has-error' : ''} ${className}`.trim()} {...rest} />
  );
}
