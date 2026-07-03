import { useEffect, useRef } from "react";
import { animate } from "animejs";
import "./app-loading.css";

type AppLoadingProps = {
  message?: string;
};

export default function AppLoading({
  message = "작업장을 준비하고 있습니다.",
}: AppLoadingProps) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) return;

    const mark = root.querySelector<HTMLElement>(".app-loading-mark");
    const pulse = root.querySelector<HTMLElement>(".app-loading-pulse");
    const path = root.querySelector<HTMLElement>(".app-loading-line");
    const dots = root.querySelectorAll<HTMLElement>(".app-loading-dots i");
    const text = root.querySelectorAll<HTMLElement>(
      ".app-loading-title, .app-loading-message",
    );

    if (!mark || !pulse || !path) return;

    const animations = [
      animate(mark, {
        opacity: [0, 1],
        scale: [0.92, 1],
        translateY: [10, 0],
        duration: 720,
        ease: "out(3)",
      }),
      animate(pulse, {
        opacity: [0.16, 0.34],
        scale: [0.96, 1.08],
        duration: 1300,
        loop: true,
        alternate: true,
        ease: "inOut(2)",
      }),
      animate(path, {
        translateX: ["-64%", "64%"],
        opacity: [0.45, 1],
        duration: 1250,
        loop: true,
        alternate: true,
        ease: "inOut(2)",
      }),
      animate(dots, {
        translateY: [0, -5, 0],
        opacity: [0.35, 1, 0.35],
        delay: (_target: unknown, index = 0) => index * 140,
        duration: 900,
        loop: true,
        ease: "inOut(2)",
      }),
      animate(text, {
        opacity: [0, 1],
        translateY: [6, 0],
        delay: (_target: unknown, index = 0) => 180 + index * 80,
        duration: 520,
        ease: "out(2)",
      }),
    ];

    return () => {
      animations.forEach((animation) => animation.revert());
    };
  }, []);

  return (
    <main
      ref={rootRef}
      className="app-loading"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-loading-content">
        <div className="app-loading-mark-wrap">
          <span className="app-loading-pulse" aria-hidden="true" />
          <img
            className="app-loading-mark"
            src="/logo/logo-blush.webp"
            alt="자격증공장"
          />
        </div>
        <div className="app-loading-track" aria-hidden="true">
          <span className="app-loading-line" />
        </div>
        <strong className="app-loading-title">자격증공장</strong>
        <p className="app-loading-message">{message}</p>
        <span className="app-loading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </main>
  );
}
