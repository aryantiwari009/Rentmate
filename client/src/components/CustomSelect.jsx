import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  ariaLabel,
  id,
  name,
  className = "",
  size = "normal",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const listboxRef = useRef(null);

  // Normalize options to [{ value, label }]
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "object" && opt !== null) {
      return { value: opt.value, label: opt.label ?? String(opt.value) };
    }
    return { value: opt, label: String(opt) };
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value) || null;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Sync focused index with selected option when opened
  useEffect(() => {
    if (isOpen) {
      const idx = normalizedOptions.findIndex((opt) => opt.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, value]);

  // Auto scroll focused item into view in long lists
  useEffect(() => {
    if (isOpen && listboxRef.current && focusedIndex >= 0) {
      const activeEl = listboxRef.current.children[focusedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, focusedIndex]);

  function handleKeyDown(e) {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev < normalizedOptions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : normalizedOptions.length - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < normalizedOptions.length) {
          onChange(normalizedOptions[focusedIndex].value);
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  }

  function handleSelect(optValue) {
    onChange(optValue);
    setIsOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className} ${size === "compact" ? "custom-select-compact" : ""} ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`}
      onKeyDown={handleKeyDown}
    >
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <button
        type="button"
        id={id}
        className="custom-select-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className="custom-select-label">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="custom-select-chevron"
        />
      </button>

      {isOpen && (
        <ul
          ref={listboxRef}
          className="custom-select-menu"
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
        >
          {normalizedOptions.map((opt, index) => {
            const isSelected = opt.value === value;
            const isFocused = index === focusedIndex;

            return (
              <li
                key={opt.value}
                id={id ? `${id}-opt-${index}` : undefined}
                role="option"
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? "selected" : ""} ${isFocused ? "focused" : ""}`}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <span className="custom-select-option-text">{opt.label}</span>
                {isSelected && (
                  <Check size={14} aria-hidden="true" className="custom-select-check" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
