import {Suspense} from "react";
import { AlertsView } from "@/components/views/alerts";
export default function AlertsPage() {return <Suspense fallback={<div className="text-sm text-muted-foreground">Loading alert filters ...</div>}><AlertsView /></Suspense>;}