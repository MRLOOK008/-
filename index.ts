import {
	EventsSDK,
	LocalPlayer,
	Menu,
	npc_dota_hero_huskar,
	TrackingProjectile,
	Item
} from "github.com/octarine-public/wrapper/index"

new (class HuskarArmletAbuse {

	private readonly entry = Menu.AddEntry("Huskar")

	private readonly tree = this.entry.AddNode("Armlet Abuse")
	private readonly state = this.tree.AddToggle("State", false)
	private readonly hpThreshold = this.tree.AddSlider("HP Threshold %", 40, 5, 90)
	private readonly reactivateDelay = this.tree.AddSlider("Reactivate Delay ms", 100, 30, 500)
	private readonly projectileMode = this.tree.AddToggle("Projectile Trigger", true)

	private offTimer = -1
	private readonly projectiles = new Set<TrackingProjectile>()

	constructor() {
		EventsSDK.on("Tick", this.Tick.bind(this))
		EventsSDK.on("TrackingProjectileCreated", this.OnProjectileCreated.bind(this))
		EventsSDK.on("TrackingProjectileDestroyed", this.OnProjectileDestroyed.bind(this))
		EventsSDK.on("GameEnded", this.GameEnded.bind(this))
	}

	private GetHero(): npc_dota_hero_huskar | undefined {
		const hero = LocalPlayer?.Hero
		if (hero === undefined || !(hero instanceof npc_dota_hero_huskar)) {
			return undefined
		}
		return hero
	}

	private GetArmlet(hero: npc_dota_hero_huskar): Item | undefined {
		return hero.Items.find(i => i.Name === "item_armlet")
	}

	private CanAbuse(hero: npc_dota_hero_huskar): boolean {
		return (
			hero.IsAlive &&
			!hero.IsStunned &&
			!hero.IsHexed &&
			!hero.IsSilenced
		)
	}

	private TurnOff(hero: npc_dota_hero_huskar, armlet: Item): void {
		if (!armlet.IsActivated || !armlet.CanBeCasted()) {
			return
		}
		hero.CastToggle(armlet, false, true)
		this.offTimer = this.reactivateDelay.value / 1000
	}

	private TurnOn(hero: npc_dota_hero_huskar, armlet: Item): void {
		if (armlet.IsActivated || !armlet.CanBeCasted()) {
			return
		}
		hero.CastToggle(armlet, false, true)
	}

	private Tick(dt: number): void {
		if (!this.state.value) {
			return
		}

		const hero = this.GetHero()
		if (hero === undefined) {
			return
		}

		if (!this.CanAbuse(hero)) {
			this.offTimer = -1
			return
		}

		const armlet = this.GetArmlet(hero)
		if (armlet === undefined) {
			this.offTimer = -1
			return
		}

		if (this.offTimer >= 0) {
			this.offTimer -= dt
			if (this.offTimer <= 0) {
				this.offTimer = -1
				if (this.CanAbuse(hero)) {
					this.TurnOn(hero, armlet)
				}
			}
			return
		}

		const hpPercent = (hero.HP / hero.MaxHP) * 100
		if (hpPercent > this.hpThreshold.value) {
			return
		}

		this.TurnOff(hero, armlet)
	}

	private OnProjectileCreated(projectile: TrackingProjectile): void {
		if (!this.state.value || !this.projectileMode.value) {
			return
		}

		const hero = this.GetHero()
		if (hero === undefined || !this.CanAbuse(hero)) {
			return
		}

		if (projectile.Target !== hero) {
			return
		}

		this.projectiles.add(projectile)

		const armlet = this.GetArmlet(hero)
		if (armlet === undefined || this.offTimer >= 0) {
			return
		}

		this.TurnOff(hero, armlet)
	}

	private OnProjectileDestroyed(projectile: TrackingProjectile): void {
		this.projectiles.delete(projectile)
	}

	private GameEnded(): void {
		this.offTimer = -1
		this.projectiles.clear()
	}

})()
