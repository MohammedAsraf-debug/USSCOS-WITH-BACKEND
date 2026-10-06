export default function FormSelect({ label, name, value, onChange, options, error, required = false, placeholder }) {
  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label} {required && <span className="form-field__required">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        className={error ? 'form-input form-input--error' : 'form-input'}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="form-field__error">{error}</span>}
    </div>
  )
}