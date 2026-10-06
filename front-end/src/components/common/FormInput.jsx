export default function FormInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  ...props
}) {
  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label} {required && <span className="form-field__required">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`form-input ${error ? 'form-input--error' : ''}`}
        {...props}
      />
      {error && <span className="form-field__error">{error}</span>}
    </div>
  )
}

export function TextArea({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  rows = 4,
  required = false,
}) {
  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label} {required && <span className="form-field__required">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`form-input ${error ? 'form-input--error' : ''}`}
      />
      {error && <span className="form-field__error">{error}</span>}
    </div>
  )
}