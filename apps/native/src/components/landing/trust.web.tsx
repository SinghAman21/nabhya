import { Icon } from "./icons.web";

const TRUST_ITEMS = [
	{
		icon: "ShieldCheck",
		title: "Documents, reviewed.",
		label: "NGO registration & PAN",
		body: "NGO registration certificates and PAN documents are reviewed by authorised administrators before public publishing. This verifies submitted documents; it does not guarantee an organisation's conduct.",
	},
	{
		icon: "People",
		title: "Applications, answered.",
		label: "The NGO decides who joins.",
		body: "Sign in and verify your identity before applying. Applications remain pending until the NGO accepts or rejects them. You can track the decision in your applications; applying does not guarantee a place.",
	},
	{
		icon: "File",
		title: "Your time, recognised.",
		label: "Attendance & certificates",
		body: "NGOs can record attendance and hours served, then issue certificates with public verification codes. These are records of participation reported by the issuing NGO.",
	},
];
export function TrustSection() {
	return (
		<section
			id="trust"
			className="landing-section landing-trust"
			aria-labelledby="trust-heading"
		>
			<div className="landing-container">
				<div className="landing-section-heading">
					<div>
						<p className="landing-eyebrow">A LITTLE REASSURANCE</p>
						<h2 id="trust-heading">
							Good intentions.
							<br />
							<em>Clear next steps.</em>
						</h2>
					</div>
					<p>
						Know who's asking, what happens next,
						<br />
						and where your participation is recorded.
					</p>
				</div>
				<div className="trust-grid">
					{TRUST_ITEMS.map((item) => (
						<details key={item.title} className="trust-item">
							<summary>
								<span className="trust-icon">
									<Icon name={item.icon} size={29} />
								</span>
								<strong>{item.title}</strong>
								<span className="trust-item-label">
									{item.label}
									<Icon name="ChevronDown" size={15} />
								</span>
							</summary>
							<p>{item.body}</p>
						</details>
					))}
				</div>
				<details className="trust-more">
					<summary>
						Donations & organisation reports{" "}
						<Icon name="ChevronDown" size={14} />
					</summary>
					<p>
						Monetary donations use Razorpay checkout; completed payments have
						records and PDF acknowledgements. A payment receipt is not an 80G
						tax certificate. NGO-published updates and financial reports are not
						independently audited impact outcomes.
					</p>
				</details>
			</div>
		</section>
	);
}
