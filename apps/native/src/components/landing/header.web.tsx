import { type ReactNode, useRef } from "react";
import { Cta } from "./controls.web";
import { Icon } from "./icons.web";
export function Header({ logo }: { logo: ReactNode }) {
	const menu = useRef<HTMLDetailsElement>(null);
	const close = () => {
		if (menu.current) menu.current.open = false;
	};
	return (
		<header className="landing-header">
			<div className="landing-container landing-header-inner">
				<a
					onClick={close}
					href="/"
					className="landing-brand"
					aria-label="Nabhya home"
				>
					{logo}
				</a>
				<nav className="landing-desktop-nav" aria-label="Main navigation">
					<a onClick={close} href="/ngos">
						Explore NGOs
					</a>
					<a href="#causes">Causes</a>
					<a href="#how-it-works">How it works</a>
				</nav>
				<div className="landing-account-nav">
					<a className="landing-sign-in" href="/login">
						Sign in <Icon name="ArrowUpRight" size={15} />
					</a>
					<Cta href="/signup" arrow={false} variant="secondary">
						Register your NGO
					</Cta>
				</div>
				<details
					className="landing-mobile-nav"
					ref={menu}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							close();
							menu.current?.querySelector("summary")?.focus();
						}
					}}
				>
					<summary aria-label="Navigation menu">
						<span className="landing-sr-only">Navigation menu</span>
						<Icon name="Menu" size={24} />
					</summary>
					<nav aria-label="Mobile navigation">
						<a onClick={close} href="/events">
							Explore opportunities <Icon name="ArrowUpRight" />
						</a>
						<a onClick={close} href="/ngos">
							Explore NGOs
						</a>
						{/* biome-ignore lint/a11y/useValidAnchor: Real section link; handler only closes the mobile menu. */}
						<a onClick={close} href="#causes">
							Causes
						</a>
						{/* biome-ignore lint/a11y/useValidAnchor: Real section link; handler only closes the mobile menu. */}
						<a onClick={close} href="#how-it-works">
							How it works
						</a>
						<a onClick={close} href="/signup">
							Register your NGO
						</a>
						<a onClick={close} href="/login">
							Sign in <Icon name="ArrowUpRight" />
						</a>
					</nav>
				</details>
			</div>
		</header>
	);
}
