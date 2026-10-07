'use client';
import { apiClient } from '@/services/api/client';
import type { DirectoryOption, DirectoryResponse } from '@/types/directory';
import { mergeDirectoryOptions, searchBuiltInDirectory } from '@/utils/directory';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
export function OrganizationPicker({
  kind,
  label,
  value,
  defaultValue = '',
  name,
  onChange,
  onSelect,
  required = true,
  showHelp = true,
}: {
  kind: 'universities' | 'companies';
  label: string;
  value?: string;
  defaultValue?: string;
  name?: string;
  onChange?: (value: string) => void;
  onSelect?: (option: DirectoryOption) => void;
  required?: boolean;
  showHelp?: boolean;
}) {
  const id = useId();
  const [internal, setInternal] = useState(defaultValue),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    [country, setCountry] = useState('India');
  const text = value ?? internal;
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim().slice(0, 100)), 350);
    return () => clearTimeout(timer);
  }, [text]);
  const { data, isFetching, error } = useQuery<DirectoryResponse>({
    queryKey: ['organization-directory', kind, search, country],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get(`/directory/${kind}`, {
          params: { q: search, ...(kind === 'universities' ? { country } : {}) },
          signal,
        })
      ).data,
    enabled: open && search.length >= 2,
    staleTime: 1800000,
    retry: false,
  });
  const current = search === text.trim().slice(0, 100);
  const options = mergeDirectoryOptions(
    current ? data?.results || [] : [],
    searchBuiltInDirectory(kind, text, country),
  );
  const update = (next: string) => {
    setInternal(next);
    onChange?.(next);
  };
  const choose = (option: DirectoryOption) => {
    update(option.name);
    onSelect?.(option);
    setOpen(false);
    setActive(-1);
  };
  return (
    <div className="form-field directory-picker">
      <label htmlFor={id}>{label}</label>
      {kind === 'universities' && (
        <select
          className="directory-country"
          aria-label="Institution directory country"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setActive(-1);
          }}
        >
          <option value="India">India</option>
          <option value="">Worldwide</option>
        </select>
      )}
      <input
        id={id}
        name={name}
        value={text}
        required={required}
        minLength={2}
        maxLength={150}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && text.trim().length >= 2}
        aria-controls={`${id}-list`}
        aria-activedescendant={
          active >= 0 && options[active] ? `${id}-option-${active}` : undefined
        }
        aria-describedby={showHelp ? `${id}-help` : undefined}
        placeholder={
          kind === 'universities' ? 'Search college or university' : 'Search company name'
        }
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setOpen(false);
        }}
        onChange={(e) => {
          update(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              e.key === 'ArrowDown' ? Math.min(i + 1, options.length - 1) : Math.max(i - 1, 0),
            );
          } else if (e.key === 'Enter' && open && active >= 0 && options[active]) {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {open && text.trim().length >= 2 && (
        <div className="directory-results">
          {(!current || isFetching) && <p role="status">Searching…</p>}
          <div id={`${id}-list`} role="listbox" aria-label={`${label} suggestions`}>
            {options.map((option, i) => (
              <div
                key={option.id}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={active === i}
                className={`directory-option ${active === i ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
              >
                <strong>{option.name}</strong>
                <small>
                  {[option.region, option.country, option.domain].filter(Boolean).join(' · ')}
                </small>
              </div>
            ))}
          </div>
          {!isFetching && options.length === 0 && (current || false) && (
            <p role="status">
              {error || data?.unavailable
                ? 'More suggestions are unavailable. Enter the name manually.'
                : 'No matches found. You can enter the name manually.'}
            </p>
          )}
        </div>
      )}
      {showHelp && (
        <small id={`${id}-help`}>
          {kind === 'universities' ? 'University directory: Hipo.' : 'Company directory: Clearbit.'}{' '}
          Select a suggestion or type manually. Selection does not verify affiliation.
        </small>
      )}
    </div>
  );
}
