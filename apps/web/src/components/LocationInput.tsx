import { useEffect, useState } from 'react';
import { searchAddresses, type AddressSuggestion } from '../services/maps';

interface LocationInputProps {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  value: string;
  tone: 'start' | 'end';
  error?: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
}

export function LocationInput({
  id,
  name,
  label,
  placeholder,
  value,
  tone,
  error,
  onChange,
  onSelect,
}: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!focused || query.length < 3) {
      setSuggestions([]);
      setSearching(false);
      setServiceError('');
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchAddresses(query, controller.signal);
        if (active) {
          setSuggestions(result);
          setServiceError('');
        }
      } catch {
        if (active) {
          setSuggestions([]);
          setServiceError('Address suggestions are temporarily unavailable. Please try again.');
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 450);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [focused, value]);

  return (
    <label className="field location-field" htmlFor={id}>
      <span className="field__label">
        {label} <span className="field__required" aria-hidden="true">*</span>
      </span>
      <span className="field__control">
        <svg
          className={`field__pin-icon field__pin-icon--${tone}`}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 22s8-7.2 8-13a8 8 0 1 0-16 0c0 5.8 8 13 8 13Z" fill="currentColor" />
          <circle cx="12" cy="9" r="2.75" fill="white" />
        </svg>
        <input
          id={id}
          name={name}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => onChange(event.target.value)}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-autocomplete="list"
          aria-expanded={focused && suggestions.length > 0}
          aria-controls={`${id}-suggestions`}
        />
      </span>
      {focused && suggestions.length > 0 && (
        <div className="location-suggestions" id={`${id}-suggestions`} role="listbox">
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              key={`${suggestion.id}-${index}`}
              role="option"
              aria-selected="false"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(suggestion.label);
                onSelect(suggestion.label);
                setSuggestions([]);
                setFocused(false);
              }}
            >
              <span aria-hidden="true">⌖</span>
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
      {focused && searching && (
        <small className="location-field__feedback" role="status" aria-live="polite">
          Finding nearby addresses…
        </small>
      )}
      {focused && !searching && !serviceError && value.trim().length >= 3 && suggestions.length === 0 && (
        <small className="location-field__feedback" role="status" aria-live="polite">
          No close address matches. Try adding a town or postcode.
        </small>
      )}
      {error && <small className="field__error" id={`${id}-error`} role="alert">{error}</small>}
      {serviceError && (
        <small className="location-field__error" role="status">
          {serviceError}
        </small>
      )}
    </label>
  );
}
