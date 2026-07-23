import { BUSINESS_INFORMATION } from "../../config/business";
import "./business-footer.css";

export default function BusinessFooter() {
  const business = BUSINESS_INFORMATION;

  return (
    <footer className="business-footer" aria-label="사업자 정보">
      <div className="business-footer__inner">
        <div className="business-footer__brand">
          <strong>{business.companyName}</strong>
          <span>{business.serviceName}</span>
        </div>

        <dl className="business-footer__information">
          <div>
            <dt>대표자</dt>
            <dd>{business.representative}</dd>
          </div>
          <div>
            <dt>사업자등록번호</dt>
            <dd>{business.registrationNumber}</dd>
          </div>
          <div>
            <dt>사업장 주소</dt>
            <dd>{business.address}</dd>
          </div>
          <div>
            <dt>대표전화</dt>
            <dd>
              <a href={`tel:${business.phoneHref}`}>{business.phoneDisplay}</a>
            </dd>
          </div>
        </dl>

        <nav className="business-footer__links" aria-label="서비스 정책">
          <a href="/policies#terms">이용약관</a>
          <a href="/policies#privacy">개인정보처리방침</a>
          <a href="/policies#refund">환불정책</a>
        </nav>
      </div>
    </footer>
  );
}
