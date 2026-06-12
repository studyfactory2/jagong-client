import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import "./app-shell.css";

type AppShellProps = {
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: boolean;
  wide?: boolean;
  className?: string;
};

export default function AppShell({
  title,
  subtitle,
  backTo = "/waiting-room",
  actions,
  children,
  footer = true,
  wide = false,
  className = "",
}: AppShellProps) {
  const navigate = useNavigate();
  const classes = ["app-shell", wide ? "is-wide" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <header className="app-shell-head">
        <button className="app-shell-back" onClick={() => navigate(backTo)} type="button">
          <ArrowBackIcon />
          <span>뒤로가기</span>
        </button>

        <div className="app-shell-title-wrap">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>

        <div className="app-shell-actions">{actions}</div>
      </header>

      <main className="app-shell-body">{children}</main>

      {footer && <p className="app-foot">자격증공장 재택근무반</p>}
    </div>
  );
}
