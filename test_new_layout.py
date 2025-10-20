"""
Test script for new Mobile.de layout parsing
"""
from bs4 import BeautifulSoup
from scrapers.ScraperMobilede import ScraperMobilede
import json

# Sample HTML from new layout
html_sample = """
<article class="contentBox_ContentBox__L0wd9 contentBox_ContentBox--level-1___2o5j">
    <section class="typography_copy__hyPNf contentSection_ContentSection__Ye1PD padding_none__6zXb7">
        <div>
            <div class="cornerBadge_CornerBadge__cqXpp TopAdListing_topListingBadge__L_Iqk cornerBadge_CornerBadge__ribbon__13CuZ cornerBadge_CornerBadge__ribbon--action__1QM5G">
                <div class="cornerBadge_CornerBadge__label__6WzLp typography_title__TamOM cornerBadge_CornerBadge--action__GWSoq">Top</div>
            </div>
            <div class="BaseListing_container__lzcoK BaseListing_listingCard__CkWB_ BaseListing_top__7mYJs" data-testid="top-result-listing-1">
                <a class="BaseListing_containerLink___4jHz" data-testid="top-result-listing-1-link" target="_blank" type="unstyled" href="/fr/voiture/d%C3%A9tails.html?id=415386307&amp;vc=Car&amp;searchId=abc">
                    <div class="ListingImageWithThumbnails_container___zFPr">
                        <div class="ListingImage_container__jzUck ListingImageWithThumbnails_previewImage__RTbDf ListingImageWithThumbnails_previewImageNoBottomBorderRadius__noZnZ">
                            <img alt="" data-testid="top-result-listing-1-image-large" loading="lazy" decoding="async" data-nimg="fill" 
                                 class="ListingPreviewImage_image__19sST" 
                                 src="https://img.classistatic.de/api/v1/mo-prod/images/f7/f795308c-309c-4999-a1cb-e3ec24059f30?rule=mo-1600">
                        </div>
                        <img alt="" data-testid="top-result-listing-1-image-thumbnail-left" loading="lazy" 
                             class="ListingPreviewThumbnail_image__d_YH4" 
                             src="https://img.classistatic.de/api/v1/mo-prod/images/d7/d7e15e67-018f-49e1-b9cd-05f75e57f6f6?rule=mo-200">
                        <img alt="" data-testid="top-result-listing-1-image-thumbnail-mid" loading="lazy" 
                             class="ListingPreviewThumbnail_image__d_YH4" 
                             src="https://img.classistatic.de/api/v1/mo-prod/images/25/256259bc-a79a-4c19-8d98-e6cdc5bbf18c?rule=mo-200">
                    </div>
                    <div class="BaseListing_topMiddle__vHswV">
                        <div class="ListingTitle_wrapper__RmYNg ListingTitle_wrapperTestAligned__wGCdS" data-testid="top-result-listing-1-title">
                            <h2 class="ListingTitle_title__p3CnA">
                                <span class="typography_meta__EI4Bp margin_right_XS__bbPY6 sponsoredBadge_SponsoredBadge__DI71D typography_meta__EI4Bp" data-testid="sponsored-badge">Sponsorisée</span>
                                Mitsubishi Eclipse Cross
                            </h2>
                        </div>
                        <div class="PriceSection_priceLabelContainer__IC8O5" data-testid="top-result-listing-1-price-section">
                            <div class="PriceSection_priceLabel__mVIXa" data-testid="main-price-label">
                                <div>
                                    <span class="typography_title__TamOM PriceLabel_strikeThrough__99me8 PriceLabel_strikeThroughAsBlock__NLPEN" data-testid="price-strike">28 950&nbsp;€</span>
                                    <span class="PriceLabel_mainPrice__3SZut" data-testid="price-label">27 950&nbsp;€</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="BaseListing_bottomMiddle__ji_ff">
                        <section class="BaseListing_listingAvailability__35hia" data-testid="listing-details">
                            <div class="BaseListing_listingAttributeLine__t6UvN typography_copy__hyPNf" data-testid="listing-details-attributes">
                                <div class="">
                                    <strong>Non accidenté</strong> • <strong>Immatriculation temporaire</strong> • PI 12/2024 • 20&nbsp;km • 72&nbsp;kW&nbsp;(98&nbsp;Ch DIN) • Hybride (essence/électrique)
                                </div>
                            </div>
                        </section>
                        <div class="SellerInfo_sellerInfoContainer__JrahE" data-testid="seller-info">
                            <div class="SellerInfo_dealerDataContainer__C9FHI">
                                <div class="SellerInfo_dealerNameContainer__CZ7Ws">
                                    <span class="SellerInfo_dealerName__9h_a1 typography_weight-500__CaB4I margin_right_S__6Zw9Z">Emil Frey Hessengarage</span>
                                    DE-60386 Frankfurt
                                </div>
                            </div>
                        </div>
                    </div>
                </a>
            </div>
        </div>
    </section>
</article>
"""

def test_new_layout():
    print("=" * 80)
    print("Testing new Mobile.de layout parser")
    print("=" * 80)
    
    # Parse HTML
    soup = BeautifulSoup(html_sample, "html.parser")
    article = soup.find("article")
    
    if not article:
        print("❌ Could not find article element")
        return False
    
    # Create scraper and parse article
    scraper = ScraperMobilede()
    result = scraper._parse_article(article)
    
    if not result:
        print("❌ Parser returned None")
        return False
    
    print("\n✅ Successfully parsed article!")
    print("\n📋 Parsed Data:")
    print("-" * 80)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # Verify key fields
    print("\n🔍 Verification:")
    print("-" * 80)
    
    checks = [
        ("ID", result.get("list_id"), 415386307),
        ("URL", result.get("url"), "?id=415386307"),
        ("Subject", result.get("subject"), "Mitsubishi Eclipse Cross"),
        ("Price", result.get("price", [None])[0], 27950.0),
        ("Source", result.get("source"), "mobilede"),
    ]
    
    all_passed = True
    for name, actual, expected in checks:
        if name == "URL":
            # URL might be absolute
            if expected in str(actual):
                print(f"✅ {name}: {actual}")
            else:
                print(f"❌ {name}: Expected '{expected}' in '{actual}'")
                all_passed = False
        elif name == "Price":
            if abs(actual - expected) < 0.01:
                print(f"✅ {name}: {actual}")
            else:
                print(f"❌ {name}: Expected {expected}, got {actual}")
                all_passed = False
        else:
            if actual == expected:
                print(f"✅ {name}: {actual}")
            else:
                print(f"❌ {name}: Expected '{expected}', got '{actual}'")
                all_passed = False
    
    # Check attributes
    print("\n📊 Attributes:")
    print("-" * 80)
    attrs = result.get("attributes", [])
    attr_dict = {a["key"]: a["value"] for a in attrs}
    
    print(f"Brand: {attr_dict.get('brand')}")
    print(f"Model: {attr_dict.get('model')}")
    print(f"Regdate: {attr_dict.get('regdate')}")
    print(f"Mileage: {attr_dict.get('mileage')}")
    print(f"Fuel: {attr_dict.get('fuel')}")
    print(f"Horsepower: {attr_dict.get('horse_power_din')}")
    
    # Verify critical attributes
    critical_checks = [
        ("brand", "Mitsubishi"),
        ("model", "Eclipse"),
        ("regdate", "2024-12"),  # PI 12/2024 -> 2024-12
        ("mileage", 20),
        ("fuel", "Hybride (essence/électrique)"),
        ("horse_power_din", 98),
    ]
    
    print("\n🔍 Critical Attributes Check:")
    print("-" * 80)
    for key, expected in critical_checks:
        actual = attr_dict.get(key)
        if actual == expected:
            print(f"✅ {key}: {actual}")
        else:
            print(f"❌ {key}: Expected '{expected}', got '{actual}'")
            all_passed = False
    
    # Check location
    location = result.get("location", {})
    print("\n📍 Location:")
    print("-" * 80)
    print(f"City: {location.get('city')}")
    print(f"Zipcode: {location.get('zipcode')}")
    
    if location.get("zipcode") == "60386" and "Frankfurt" in str(location.get("city", "")):
        print("✅ Location parsed correctly")
    else:
        print(f"❌ Location: Expected zipcode '60386' and city containing 'Frankfurt'")
        all_passed = False
    
    # Check images
    images = result.get("images", {})
    print("\n🖼️ Images:")
    print("-" * 80)
    print(f"Number of images: {images.get('nb_images', 'N/A')}")
    print(f"URLs count: {len(images.get('urls', []))}")
    
    if images.get("urls") and len(images.get("urls", [])) >= 3:
        print("✅ Multiple images captured")
    else:
        print(f"⚠️ Expected at least 3 images, got {len(images.get('urls', []))}")
    
    print("\n" + "=" * 80)
    if all_passed:
        print("✅ ALL TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED")
    print("=" * 80)
    
    return all_passed

if __name__ == "__main__":
    success = test_new_layout()
    exit(0 if success else 1)
