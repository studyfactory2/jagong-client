import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import {
  getCurrentPolicy,
  getPolicyDocument,
} from "../../services/policy.service";
import type {
  CurrentPolicy,
  PolicyDocument,
  PolicyKey,
  PolicySection,
  PolicyTable as PolicyTableType,
} from "../../../lib/types";
import "./policies.css";

const policyOrder: PolicyKey[] = [
  "terms",
  "privacy",
  "refund",
  "camera",
  "operation",
  "marketing",
];

function uniquePolicyKeys(current: CurrentPolicy): PolicyKey[] {
  const keys = [
    ...current.registration,
    ...current.consultation,
    ...current.optional,
  ].map((item) => item.key);

  return policyOrder.filter((key) => keys.includes(key));
}

function displayDate(version: string) {
  return version.replaceAll("-", ".");
}

function SectionBody({ body }: { body: string }) {
  const lines = body.split("\n").filter((line) => line.trim());

  return (
    <div className="policy-body">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        const isBullet = trimmed.startsWith("•") || trimmed.startsWith("●");
        return (
          <p
            className={isBullet ? "policy-line is-bullet" : "policy-line"}
            key={`${index}-${trimmed.slice(0, 18)}`}
          >
            {isBullet ? trimmed.slice(1).trim() : trimmed}
          </p>
        );
      })}
    </div>
  );
}

function PolicyTable({ table }: { table: PolicyTableType }) {
  return (
    <div className="policy-table-wrap">
      <table className="policy-table">
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join("-")}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}-${cell}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicySectionArticle({
  documentKey,
  section,
}: {
  documentKey: PolicyKey;
  section: PolicySection;
}) {
  return (
    <article key={`${documentKey}-${section.heading}`}>
      <h3>{section.heading}</h3>
      <SectionBody body={section.body} />
      {section.table && <PolicyTable table={section.table} />}
      {section.footer && <SectionBody body={section.footer} />}
    </article>
  );
}

export default function Policies() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<CurrentPolicy | null>(null);
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadPolicies() {
      setLoading(true);
      setError("");

      try {
        const nextCurrent = await getCurrentPolicy();
        const keys = uniquePolicyKeys(nextCurrent);
        const nextDocuments = await Promise.all(keys.map(getPolicyDocument));

        if (!alive) return;
        setCurrent(nextCurrent);
        setDocuments(nextDocuments);
      } catch (loadError) {
        if (!alive) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "서비스 정책을 불러오지 못했습니다.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadPolicies();

    return () => {
      alive = false;
    };
  }, []);

  const pdfUrl = current?.pdfUrl;
  const navItems = useMemo(
    () =>
      documents.map((document) => ({
        id: document.key,
        label: document.title
          .replace("자격증공장 재택근무반 ", "")
          .replace("개인정보 처리방침", "개인정보"),
      })),
    [documents],
  );

  return (
    <main className="policy">
      <header className="policy-head">
        <button onClick={() => navigate(-1)} type="button">
          <ArrowBackIcon /> 뒤로가기
        </button>

        <span>자격증공장 재택근무반</span>
        <h1>서비스 정책</h1>
        <p>시행일 {current ? displayDate(current.version) : "확인 중"}</p>

        {pdfUrl && (
          <div className="policy-actions">
            <a href={pdfUrl} target="_blank" rel="noreferrer">
              <PictureAsPdfOutlinedIcon />
              PDF 보기
              <OpenInNewOutlinedIcon className="policy-action-small" />
            </a>
            <a href={pdfUrl} download>
              <DownloadOutlinedIcon />
              PDF 다운로드
            </a>
          </div>
        )}
      </header>

      {navItems.length > 0 && (
        <nav className="policy-nav" aria-label="서비스 정책 목차">
          {navItems.map((item) => (
            <a href={`#${item.id}`} key={item.id}>
              {item.label}
            </a>
          ))}
        </nav>
      )}

      {loading && (
        <section className="policy-state" aria-live="polite">
          서비스 정책을 불러오는 중입니다.
        </section>
      )}

      {!loading && error && (
        <section className="policy-state is-error" aria-live="polite">
          <strong>{error}</strong>
          <p>잠시 후 다시 시도해 주세요.</p>
        </section>
      )}

      {!loading &&
        documents.map((document) => (
          <section
            className="policy-section"
            id={document.key}
            key={document.key}
          >
            <div className="policy-section-head">
              <span className="policy-kicker">
                {document.required.registration ||
                document.required.consultation
                  ? "필수"
                  : "선택"}
              </span>
              <h2>{document.title}</h2>
              <p>{document.summary}</p>
            </div>

            <div className="policy-articles">
              {document.sections.map((section) => (
                <PolicySectionArticle
                  documentKey={document.key}
                  key={`${document.key}-${section.heading}`}
                  section={section}
                />
              ))}
            </div>
          </section>
        ))}

      <footer className="policy-foot">
        <strong>수험생연구소</strong>
        <span>자격증공장 재택근무반 서비스 정책</span>
      </footer>
    </main>
  );
}
