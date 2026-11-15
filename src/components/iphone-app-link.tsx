import Link from "next/link";
import { ArrowUpRight, Smartphone } from "lucide-react";
import "./iphone-app-link.css";

export function IphoneAppLink() {
  return (
    <Link className="iphone-app-link" href="/ios">
      <span className="iphone-app-link-icon" aria-hidden="true">
        <Smartphone size={21} strokeWidth={1.6} />
      </span>
      <span className="iphone-app-link-copy">
        <span className="iphone-app-link-title">iPhone app</span>
        <span className="iphone-app-link-status">Coming soon</span>
      </span>
      <ArrowUpRight
        className="iphone-app-link-arrow"
        size={15}
        aria-hidden="true"
      />
    </Link>
  );
}
