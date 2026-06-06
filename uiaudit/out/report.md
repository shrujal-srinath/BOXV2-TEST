# UI/UX Audit Report
Viewport: 1024×600 (Waveshare 7")

## Scoreboard · Minimal (default)  `/uiaudit/scoreboard-minimal`
Screenshot: `uiaudit/out/sb-minimal.png`
### axe-core (0 violations)
_None._
### Touch targets under 44×44 (0)
_None._

## Scoreboard · Minimal — both teams in BONUS  `/uiaudit/scoreboard-minimal?bonus=1`
Screenshot: `uiaudit/out/sb-minimal-bonus.png`
### axe-core (0 violations)
_None._
### Touch targets under 44×44 (0)
_None._

## Scoreboard · Minimal — shot clock <5s  `/uiaudit/scoreboard-minimal?lowshot=1`
Screenshot: `uiaudit/out/sb-minimal-lowshot.png`
### axe-core (0 violations)
_None._
### Touch targets under 44×44 (0)
_None._

## Scoreboard · Minimal — shot clock at 0  `/uiaudit/scoreboard-minimal?shotzero=1`
Screenshot: `uiaudit/out/sb-minimal-shotzero.png`
### axe-core (0 violations)
_None._
### Touch targets under 44×44 (0)
_None._

## Scoreboard · Minimal — period ended  `/uiaudit/scoreboard-minimal?periodOver=1`
Screenshot: `uiaudit/out/sb-minimal-periodend.png`
### axe-core (0 violations)
_None._
### Touch targets under 44×44 (0)
_None._

## Scoreboard · Classic (FUI)  `/uiaudit/scoreboard-classic`
Screenshot: `uiaudit/out/sb-classic.png`
### axe-core (4 violations)
- **SERIOUS** `color-contrast` — Elements must meet minimum color contrast ratio thresholds  
  Affected: 16 nodes. https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=axeAPI
- **MODERATE** `landmark-one-main` — Document should have one main landmark  
  Affected: 1 node. https://dequeuniversity.com/rules/axe/4.12/landmark-one-main?application=axeAPI
- **MODERATE** `page-has-heading-one` — Page should contain a level-one heading  
  Affected: 1 node. https://dequeuniversity.com/rules/axe/4.12/page-has-heading-one?application=axeAPI
- **MODERATE** `region` — All page content should be contained by landmarks  
  Affected: 10 nodes. https://dequeuniversity.com/rules/axe/4.12/region?application=axeAPI
### Touch targets under 44×44 (0)
_None._

## Touch deck · Minimal  `/uiaudit/touchdeck-minimal`
Screenshot: `uiaudit/out/td-minimal.png`
### axe-core (0 violations)
_None._
### Touch targets under 44×44 (0)
_None._

## Touch deck · Classic (FUI)  `/uiaudit/touchdeck-classic`
Screenshot: `uiaudit/out/td-classic.png`
### axe-core (4 violations)
- **SERIOUS** `color-contrast` — Elements must meet minimum color contrast ratio thresholds  
  Affected: 15 nodes. https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=axeAPI
- **MODERATE** `landmark-one-main` — Document should have one main landmark  
  Affected: 1 node. https://dequeuniversity.com/rules/axe/4.12/landmark-one-main?application=axeAPI
- **MODERATE** `page-has-heading-one` — Page should contain a level-one heading  
  Affected: 1 node. https://dequeuniversity.com/rules/axe/4.12/page-has-heading-one?application=axeAPI
- **MODERATE** `region` — All page content should be contained by landmarks  
  Affected: 21 nodes. https://dequeuniversity.com/rules/axe/4.12/region?application=axeAPI
### Touch targets under 44×44 (0)
_None._

## Shot popup · Advanced (+2 court → player → context)  `/uiaudit/shotflow-advanced?points=2`
Screenshot: `uiaudit/out/shot-advanced-p2.png`
### axe-core (4 violations)
- **SERIOUS** `color-contrast` — Elements must meet minimum color contrast ratio thresholds  
  Affected: 9 nodes. https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=axeAPI
- **MODERATE** `landmark-one-main` — Document should have one main landmark  
  Affected: 1 node. https://dequeuniversity.com/rules/axe/4.12/landmark-one-main?application=axeAPI
- **MODERATE** `page-has-heading-one` — Page should contain a level-one heading  
  Affected: 1 node. https://dequeuniversity.com/rules/axe/4.12/page-has-heading-one?application=axeAPI
- **MODERATE** `region` — All page content should be contained by landmarks  
  Affected: 6 nodes. https://dequeuniversity.com/rules/axe/4.12/region?application=axeAPI
### Touch targets under 44×44 (0)
_None._

## Shot popup · Advanced (+1 free throw — no court step)  `/uiaudit/shotflow-advanced?points=1`
Screenshot: `uiaudit/out/shot-advanced-p1.png`
### axe-core (4 violations)
- **SERIOUS** `color-contrast` — Elements must meet minimum color contrast ratio thresholds  
  Affected: 2 nodes. https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=axeAPI
- **MODERATE** `landmark-one-main` — Document should have one main landmark  
  Affected: 1 node. https://dequeuniversity.com/rules/axe/4.12/landmark-one-main?application=axeAPI
- **MODERATE** `page-has-heading-one` — Page should contain a level-one heading  
  Affected: 1 node. https://dequeuniversity.com/rules/axe/4.12/page-has-heading-one?application=axeAPI
- **MODERATE** `region` — All page content should be contained by landmarks  
  Affected: 6 nodes. https://dequeuniversity.com/rules/axe/4.12/region?application=axeAPI
### Touch targets under 44×44 (0)
_None._

## Shot popup · Stats player picker  `/uiaudit/shotflow-stats?points=2`
Screenshot: `uiaudit/out/shot-stats-p2.png`
### axe-core (2 violations)
- **SERIOUS** `color-contrast` — Elements must meet minimum color contrast ratio thresholds  
  Affected: 4 nodes. https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=axeAPI
- **MODERATE** `region` — All page content should be contained by landmarks  
  Affected: 4 nodes. https://dequeuniversity.com/rules/axe/4.12/region?application=axeAPI
### Touch targets under 44×44 (0)
_None._
