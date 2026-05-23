import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TypewriterProps {
  words: string[];
  speed?: number;
  deleteSpeed?: number;
  waitTime?: number;
  cursorChar?: string;
  className?: string;
  cursorClassName?: string;
}

export function Typewriter({
  words,
  speed = 70,
  deleteSpeed = 40,
  waitTime = 1500,
  cursorChar = "_",
  className,
  cursorClassName,
}: TypewriterProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const currentWord = words[currentWordIndex];

    if (isDeleting) {
      if (currentText.length > 0) {
        timeout = setTimeout(() => {
          setCurrentText(currentWord.substring(0, currentText.length - 1));
        }, deleteSpeed);
      } else {
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
      }
    } else {
      if (currentText.length < currentWord.length) {
        timeout = setTimeout(() => {
          setCurrentText(currentWord.substring(0, currentText.length + 1));
        }, speed);
      } else {
        timeout = setTimeout(() => setIsDeleting(true), waitTime);
      }
    }

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentWordIndex, words, speed, deleteSpeed, waitTime]);

  const longestWord = words.reduce((a, b) => (a.length > b.length ? a : b), "");

  return (
    <span className={cn("inline-grid items-center justify-items-start", className)}>
      <span className="invisible pointer-events-none col-start-1 row-start-1 flex items-center" aria-hidden="true">
        <span>{longestWord}</span>
        <span className={cursorClassName}>{cursorChar}</span>
      </span>

      <span className="col-start-1 row-start-1 flex items-center h-full w-full">
        <span>{currentText}</span>
        <span
          className={cn("animate-[pulse_1s_cubic-bezier(0.4,0,0.6,1)_infinite]", cursorClassName)}
          style={{ animationDuration: '0.8s' }}
        >
          {cursorChar}
        </span>
      </span>
    </span>
  );
}
