import Link from "next/link";
import { ArrowLeft, TrainFront } from "lucide-react";
import { ImportFlow } from "@/components/import-flow";
export default function ImportPage() { return <main className="auth-page"><header className="simple-header"><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Reisen</Link><Link href="/" className="brand"><span className="brand-mark"><TrainFront size={17}/></span> BahnDelay</Link></header><ImportFlow /></main>; }
