#!/usr/bin/env python3
"""Capture screenshots of the TSA tool for comparison with Copenhagen TSA software."""

from playwright.sync_api import sync_playwright
import os

OUTPUT_DIR = "/Users/matheusrech/.gemini/antigravity/playground/shining-halo/validation_screenshots"

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})

        # Navigate to the app
        page.goto('http://localhost:4173')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)  # Extra wait for canvas rendering

        # Screenshot 1: TRA vs TFA dataset (default)
        page.screenshot(path=f"{OUTPUT_DIR}/01_tsa_tra_tfa_full.png", full_page=True)
        print("✓ Captured: TRA vs TFA - Access Site Complications")

        # Screenshot of just the chart area
        chart_container = page.locator('.lg\\:col-span-2').first
        chart_container.screenshot(path=f"{OUTPUT_DIR}/02_tsa_tra_tfa_chart.png")
        print("✓ Captured: TRA vs TFA chart detail")

        # Screenshot 2: Hypothermia dataset
        dataset_selector = page.locator('select[aria-label="Select Dataset"]')
        dataset_selector.select_option(index=1)  # Second dataset
        page.wait_for_timeout(500)

        page.screenshot(path=f"{OUTPUT_DIR}/03_tsa_hypothermia_full.png", full_page=True)
        print("✓ Captured: Hypothermia in Cardiac Arrest")

        chart_container = page.locator('.lg\\:col-span-2').first
        chart_container.screenshot(path=f"{OUTPUT_DIR}/04_tsa_hypothermia_chart.png")
        print("✓ Captured: Hypothermia chart detail")

        # Screenshot 3: Corticosteroids in COVID-19
        dataset_selector.select_option(index=2)  # Third dataset
        page.wait_for_timeout(500)

        page.screenshot(path=f"{OUTPUT_DIR}/05_tsa_covid_full.png", full_page=True)
        print("✓ Captured: Corticosteroids in COVID-19")

        chart_container = page.locator('.lg\\:col-span-2').first
        chart_container.screenshot(path=f"{OUTPUT_DIR}/06_tsa_covid_chart.png")
        print("✓ Captured: COVID-19 chart detail")

        # Extract results summary from each dataset
        results = []

        for i, name in enumerate(["TRA vs TFA", "Hypothermia", "COVID-19"]):
            dataset_selector.select_option(index=i)
            page.wait_for_timeout(300)

            # Get the results panel text
            results_panel = page.locator('.space-y-6 > div:nth-child(2)').text_content()
            interpretation = page.locator('span.px-2.py-1.rounded').text_content()

            results.append({
                "dataset": name,
                "interpretation": interpretation,
                "details": results_panel
            })

        # Save results summary
        with open(f"{OUTPUT_DIR}/results_summary.txt", "w") as f:
            f.write("TSA Tool Results Summary\n")
            f.write("=" * 50 + "\n\n")
            for r in results:
                f.write(f"Dataset: {r['dataset']}\n")
                f.write(f"Interpretation: {r['interpretation']}\n")
                f.write(f"Details:\n{r['details']}\n")
                f.write("-" * 50 + "\n\n")

        print(f"\n✓ All screenshots saved to: {OUTPUT_DIR}")

        browser.close()

if __name__ == "__main__":
    main()
