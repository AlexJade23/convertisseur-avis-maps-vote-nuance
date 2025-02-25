// ==UserScript==
// @name        Convertisseur d'avis au vote nuancé avec donut et export image
// @namespace   Violentmonkey Scripts
// @match       *://**/*maps*
// @grant       none
// @version     1.5
// @author      -
// @description Script pour extraire et analyser les étoiles en Vote Nuancé avec graphique en donut et fonction d'export
// @require     https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Fonction pour extraire les informations des balises aria-label
    function extractRatingsInfo() {
        // Structure pour stocker les informations d'évaluations
        const ratingsData = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0
        };

        // Sélectionner tous les éléments qui ont un aria-label
        const elements = document.querySelectorAll('[aria-label]');

        // Ajouter un log pour le débogage
        console.log("Nombre d'éléments avec aria-label trouvés:", elements.length);

        // Expression régulière plus flexible pour trouver le format d'étoiles et d'avis
        // Exemple: "5&nbsp;étoiles, 281&nbsp;avis" ou "5 étoiles, 2 202 avis"
        const regex = /(\d+)(?:\s*|&nbsp;)étoiles?,\s*(\d[\d\s]*)(?:\s*|&nbsp;)avis/i;

        // Parcourir tous les éléments
        elements.forEach(element => {
            const ariaLabel = element.getAttribute('aria-label');
            if (ariaLabel) {
                const match = ariaLabel.match(regex);
                if (match) {
                    const stars = parseInt(match[1], 10);
                    // Supprimer les espaces pour gérer les nombres comme "2 202"
                    const reviewsStr = match[2].replace(/\s+/g, '');
                    const reviews = parseInt(reviewsStr, 10);

                    console.log("Match trouvé:", ariaLabel, "→ Étoiles:", stars, "Avis:", reviews);

                    // Ajouter au compteur correspondant
                    if (stars >= 1 && stars <= 5) {
                        ratingsData[stars] += reviews;
                    }
                }
            }
        });

        return ratingsData;
    }

    // Fonction pour trouver le nom du lieu et l'élément sélectionné
    function findPlaceInfo() {
        // Structure pour stocker les informations
        const info = {
            name: "Analyse des avis",
            element: null
        };

        // Rechercher l'élément avec aria-selected="true" qui contient "- Avis" dans l'aria-label
        const selectedTabs = document.querySelectorAll('[aria-selected="true"]');
        for (const tab of selectedTabs) {
            const ariaLabel = tab.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.includes('- Avis')) {
                // Extraire le nom du lieu (tout ce qui précède "- Avis")
                info.name = ariaLabel.split('- Avis')[0].trim();
                info.element = tab;
                console.log("Nom de lieu trouvé (aria-selected tab):", info.name);
                return info;
            }
            if (ariaLabel && ariaLabel.includes('sentation')) {
                // Extraire le nom du lieu (tout ce qui précède "- Présentation")
                info.name = ariaLabel.split('-')[0].trim();
                info.element = tab;
                console.log("Nom de lieu trouvé (aria-selected tab):", info.name);
                return info;
            }
        }

        // Méthodes de secours pour le nom (mais pas d'élément)
        // 1. Rechercher d'abord l'élément h1
        const h1Elements = document.querySelectorAll('h1');
        for (const h1 of h1Elements) {
            if (h1.textContent && h1.textContent.trim().length > 0) {
                console.log("Nom de lieu trouvé (h1):", h1.textContent.trim());
                info.name = h1.textContent.trim();
                return info;
            }
        }

        // 2. Chercher les éléments avec role="heading" et aria-level="1"
        const headings = document.querySelectorAll('[role="heading"][aria-level="1"]');
        for (const heading of headings) {
            if (heading.textContent && heading.textContent.trim().length > 0) {
                console.log("Nom de lieu trouvé (role=heading):", heading.textContent.trim());
                info.name = heading.textContent.trim();
                return info;
            }
        }

        // Si aucun nom n'est trouvé, retourner les valeurs par défaut
        return info;
    }

    // Fonction pour dessiner le diagramme en donut
    function createDonutChart(ratings) {
        // Créer l'élément SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '220');
        svg.setAttribute('height', '220');
        svg.setAttribute('viewBox', '0 0 220 220');

        // Centre du cercle
        const centerX = 110;
        const centerY = 110;
        const radius = 80;
        const innerRadius = 40; // Rayon intérieur pour le trou du donut

        // Calculer le total pour les pourcentages
        const total = Object.values(ratings).reduce((sum, val) => sum + val, 0);
        if (total === 0) return svg; // Éviter la division par zéro

        // Définir les couleurs pour chaque segment selon les spécifications
        const colors = {
            '1': '#ff7043', // 1*
            '2': '#ffcc80', // 2*
            '3': '#fff9c4', // 3*
            '4': '#c8e6c9', // 4*
            '5': '#81c784'  // 5*
        };

        // Définir l'ordre des segments
        const order = [3,2,1,5,4];

        // On commence à positionner 3* en bas (270°)
        const startPosition = 90;

        // Calculer les angles de début et de fin pour chaque segment
        let segmentAngles = [];
        let currentAngle = startPosition; // On commence à 270° (bas)

        // Pré-calcul des angles pour que 3* soit centré en bas
        const share3star = (ratings[3] / total) * 360;
        const halfShare3star = share3star / 2;

        // Position de départ pour mettre 3* au milieu en bas
        // Calcul dans le sens des aiguilles d'une montre comme dans l'image de référence
        currentAngle = startPosition - halfShare3star;

        // Création des segments du diagramme
        order.forEach(stars => {
            if (ratings[stars] === 0) {
                segmentAngles.push({stars, startAngle: 0, endAngle: 0, share: 0});
                return;
            }

            const share = (ratings[stars] / total) * 360;
            const endAngle = currentAngle + share;

            segmentAngles.push({
                stars,
                startAngle: currentAngle,
                endAngle: endAngle,
                share
            });

            currentAngle = endAngle;
        });

        // Création du groupe pour le diagramme
        const chart = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        // Dessiner chaque segment
        segmentAngles.forEach(segment => {
            if (segment.share === 0) return;

            // Dessiner le segment (arc)
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

            // Calculer les coordonnées du chemin
            const startRad = segment.startAngle * Math.PI / 180;
            const endRad = segment.endAngle * Math.PI / 180;

            // Points du chemin
            const outerX1 = centerX + radius * Math.cos(startRad);
            const outerY1 = centerY + radius * Math.sin(startRad);
            const outerX2 = centerX + radius * Math.cos(endRad);
            const outerY2 = centerY + radius * Math.sin(endRad);

            const innerX1 = centerX + innerRadius * Math.cos(endRad);
            const innerY1 = centerY + innerRadius * Math.sin(endRad);
            const innerX2 = centerX + innerRadius * Math.cos(startRad);
            const innerY2 = centerY + innerRadius * Math.sin(startRad);

            // Flag pour grand arc (1 si angle > 180°)
            const largeArcFlag = segment.share > 180 ? 1 : 0;

            // Chemin SVG - dans le sens des aiguilles d'une montre (comme dans l'image de référence)
            const d = `
                M ${outerX1} ${outerY1}
                A ${radius} ${radius} 0 ${largeArcFlag} 1 ${outerX2} ${outerY2}
                L ${innerX1} ${innerY1}
                A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerX2} ${innerY2}
                Z
            `;

            path.setAttribute('d', d);
            path.setAttribute('fill', colors[segment.stars]);
            path.setAttribute('stroke', 'white');
            path.setAttribute('stroke-width', '1');

            chart.appendChild(path);

            // Ajouter étiquette
            const midAngle = segment.startAngle + segment.share / 2;
            const labelRadius = (radius + innerRadius) / 2;
            const labelX = centerX + labelRadius * Math.cos(midAngle * Math.PI / 180);
            const labelY = centerY + labelRadius * Math.sin(midAngle * Math.PI / 180);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', labelX);
            label.setAttribute('y', labelY);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('font-size', '12');
            label.setAttribute('font-weight', 'bold');

            // Couleur du texte (noir pour les couleurs claires, blanc pour les couleurs foncées)
            const textColor = segment.stars == 2 || segment.stars == 3 || segment.stars == 4 ? 'black' : 'white';
            label.setAttribute('fill', textColor);

            // Calculer le pourcentage
            const percentage = Math.round((ratings[segment.stars] / total) * 100);
            label.textContent = percentage + '%';

            chart.appendChild(label);
        });

        // Ajouter le cercle intérieur pour le trou du donut
        const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerCircle.setAttribute('cx', centerX);
        innerCircle.setAttribute('cy', centerY);
        innerCircle.setAttribute('r', innerRadius);
        innerCircle.setAttribute('fill', 'white');
        chart.appendChild(innerCircle);

        // Ajouter le groupe au SVG
        svg.appendChild(chart);

        return svg;
    }

    // Fonction pour créer une version propre du graphique pour l'export
    function createCleanChartForExport(container, placeName) {
        // Créer un nouveau conteneur
        const exportContainer = document.createElement('div');
        exportContainer.style.width = '220px';
        exportContainer.style.backgroundColor = 'white';
        exportContainer.style.padding = '10px';
        exportContainer.style.borderRadius = '8px';
        exportContainer.style.fontFamily = 'Arial, sans-serif';
        exportContainer.style.fontSize = '12px';
        exportContainer.style.boxSizing = 'border-box';

        // Ajouter le titre
        const titleEl = document.createElement('h3');
        titleEl.textContent = placeName;
        titleEl.style.textAlign = 'center';
        titleEl.style.fontSize = '14px';
        titleEl.style.fontWeight = 'bold';
        titleEl.style.margin = '5px 0';
        exportContainer.appendChild(titleEl);

        // Récupérer et ajouter le taux
        const rateText = container.querySelector('div[style*="text-align: center"]')?.textContent || '';
        const rateEl = document.createElement('div');
        rateEl.textContent = rateText;
        rateEl.style.color = rateText.includes('-') ? 'red' : 'green';
        rateEl.style.fontWeight = 'bold';
        rateEl.style.textAlign = 'center';
        rateEl.style.margin = '10px 0';
        exportContainer.appendChild(rateEl);

        // Récupérer et cloner le graphique SVG
        const svgOriginal = container.querySelector('svg');
        if (svgOriginal) {
            const svgClone = svgOriginal.cloneNode(true);
            svgClone.style.display = 'block';
            svgClone.style.margin = '15px auto';
            exportContainer.appendChild(svgClone);
        }

        // Ajouter le lien vers le site
        const footerLink = document.createElement('div');
        footerLink.innerHTML = '<a href="https://decision-collective.fr" style="color: #666; font-size: 10px; text-decoration: none; display: block; text-align: center; margin-top: 5px;">decision-collective.fr</a>';
        exportContainer.appendChild(footerLink);

        return exportContainer;
    }

    // Fonction pour exporter le graphique en tant qu'image PNG
    function exportAsImage(container) {
        // Récupérer le nom du lieu
        const placeName = container.querySelector('h3').textContent.trim();

        // Créer une version propre pour l'export
        const cleanContainer = createCleanChartForExport(container, placeName);

        // Ajouter temporairement au DOM pour la capture (hors écran)
        cleanContainer.style.position = 'fixed';
        cleanContainer.style.left = '-9999px';
        cleanContainer.style.top = '-9999px';
        document.body.appendChild(cleanContainer);

        // Utiliser html2canvas pour capturer le conteneur propre
        html2canvas(cleanContainer, {
            backgroundColor: 'white',
            scale: 2, // Résolution plus élevée pour une meilleure qualité
            logging: false,
            useCORS: true
        }).then(canvas => {
            // Convertir le canvas en URL de données
            const imgData = canvas.toDataURL('image/png');

            // Créer un lien de téléchargement
            const downloadLink = document.createElement('a');

            // Sanitizer le nom du lieu pour le nom de fichier
            const sanitizedPlaceName = placeName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

            // Définir les attributs du lien
            downloadLink.href = imgData;
            downloadLink.download = `vote_nuance_${sanitizedPlaceName}.png`;

            // Ajouter à la page et cliquer pour déclencher le téléchargement
            document.body.appendChild(downloadLink);
            downloadLink.click();

            // Nettoyer le DOM
            document.body.removeChild(downloadLink);
            document.body.removeChild(cleanContainer);
        }).catch(error => {
            console.error('Erreur lors de l\'export de l\'image:', error);
            alert('Une erreur est survenue lors de l\'export de l\'image.');

            // Nettoyer même en cas d'erreur
            if (document.body.contains(cleanContainer)) {
                document.body.removeChild(cleanContainer);
            }
        });
    }

    // Fonction pour créer et afficher le tableau et le graphique avec onglets
    function createRatingsTable(ratingsData, placeName) {
        // Calculer le total des avis
        const totalReviews = Object.values(ratingsData).reduce((acc, val) => acc + val, 0);

        // Si aucun avis n'a été trouvé, ne pas afficher le tableau
        if (totalReviews === 0) {
            console.log("Aucun avis trouvé, le tableau ne sera pas affiché");
            return;
        }

        // Calculer le taux selon la formule ((5* + 4*) - (2* + 1*)) / total * 100
        const rate = totalReviews > 0 ?
            ((ratingsData[5] + ratingsData[4]) - (ratingsData[2] + ratingsData[1])) / totalReviews * 100 : 0;

        // Créer un conteneur pour le tableau et le taux
        const container = document.createElement('div');
        container.id = 'ratings-container';
        container.style.position = 'relative';
        container.style.top = '300px';
        container.style.left = '20px';
        container.style.zIndex = '9999';
        container.style.backgroundColor = 'white';
        container.style.boxShadow = '0 0 8px rgba(0,0,0)';
        container.style.padding = '10px';
        container.style.borderRadius = '8px';
        container.style.width = '220px';
        container.style.fontSize = '12px';

        // Créer un conteneur pour le titre et le logo (pour les aligner)
        const titleContainer = document.createElement('div');
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        titleContainer.style.justifyContent = 'center';
        titleContainer.style.margin = '0 0 8px 0';
        titleContainer.style.padding = '0 15px';

        // Créer le lien qui contiendra le logo
        const logoLink = document.createElement('a');
        logoLink.href = 'https://decision-collective.fr'; // Remplacez par l'URL de destination
        logoLink.target = '_blank'; // Pour ouvrir dans un nouvel onglet
        logoLink.rel = 'noopener noreferrer'; // Bonnes pratiques de sécurité

        // Créer l'élément d'image pour le logo
        const logo = document.createElement('img');
        logo.src = 'https://decision-collective.fr/wp-content/uploads/2021/12/cropped-favicon-32x32.png'; // Remplacez par l'URL de votre image
        logo.alt = 'decision-collective.fr';
        logo.style.height = '16px'; // Ajustez selon la taille souhaitée
        logo.style.marginRight = '5px'; // Espace entre le logo et le texte

        logoLink.appendChild(logo);

        // Modifier le titre
        const title = document.createElement('h3');
        title.textContent = placeName;
        title.style.margin = '0';
        title.style.fontSize = '14px';
        title.style.fontWeight = 'bold';
        title.style.whiteSpace = 'nowrap';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';

        // Assembler le titre et le logo dans le conteneur
        titleContainer.appendChild(logoLink);
        titleContainer.appendChild(title);

        // Ajouter un bouton pour fermer le tableau
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '2px';
        closeButton.style.right = '2px';
        closeButton.style.border = 'none';
        closeButton.style.background = 'none';
        closeButton.style.fontSize = '16px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = function() {
            document.body.removeChild(container);
        };

        // Créer l'élément pour afficher le taux
        const rateDiv = document.createElement('div');
        rateDiv.style.margin = '6px 0';
        rateDiv.style.fontFamily = 'Arial, sans-serif';
        rateDiv.style.fontWeight = 'bold';
        rateDiv.style.textAlign = 'center';

        // Formater le taux avec 0 décimale
        const formattedRate = rate.toFixed(0);
        rateDiv.textContent = `Taux de partisans net: ${formattedRate}%`;

        // Couleur selon le taux (rouge si négatif, vert si positif)
        rateDiv.style.color = rate >= 0 ? 'green' : 'red';

        // Créer les onglets
        const tabsContainer = document.createElement('div');
        tabsContainer.style.display = 'flex';
        tabsContainer.style.borderBottom = '1px solid #ccc';
        tabsContainer.style.marginBottom = '10px';

        // Onglet pour le diagramme
        const chartTab = document.createElement('div');
        chartTab.textContent = 'Graphique';
        chartTab.style.padding = '5px 10px';
        chartTab.style.cursor = 'pointer';
        chartTab.style.borderRadius = '5px 5px 0 0';
        chartTab.style.marginRight = '5px';
        chartTab.style.fontWeight = 'bold';
        chartTab.style.backgroundColor = '#f0f0f0';
        chartTab.dataset.tab = 'chart';
        chartTab.classList.add('active-tab');

        // Onglet pour le tableau
        const tableTab = document.createElement('div');
        tableTab.textContent = 'Tableau';
        tableTab.style.padding = '5px 10px';
        tableTab.style.cursor = 'pointer';
        tableTab.style.borderRadius = '5px 5px 0 0';
        tableTab.style.fontWeight = 'normal';
        tableTab.dataset.tab = 'table';

        tabsContainer.appendChild(chartTab);
        tabsContainer.appendChild(tableTab);

        // Créer le contenu des onglets
        const tabContents = document.createElement('div');
        tabContents.style.position = 'relative';

        // Créer le diagramme en donut
        const donutChart = createDonutChart(ratingsData);
        donutChart.style.display = 'block';
        donutChart.style.margin = '0 auto';
        donutChart.id = 'chart-content';

        // Créer le tableau
        const table = document.createElement('table');
        table.style.border = '1px solid #ccc';
        table.style.borderCollapse = 'collapse';
        table.style.margin = '0';
        table.style.fontFamily = 'Arial, sans-serif';
        table.style.width = '100%';
        table.id = 'table-content';
        table.style.display = 'none'; // Caché par défaut

        // Créer l'en-tête du tableau
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // Styles pour l'en-tête
        headerRow.style.backgroundColor = '#f2f2f2';

        // Ajouter les colonnes d'en-tête
        const headers = ['Nuances', 'Nb votes'];
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            th.style.padding = '6px';
            th.style.border = '1px solid #ccc';
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Créer le corps du tableau
        const tbody = document.createElement('tbody');
        const libelles = {'5': 'Pour (Fortement)', '4': 'Pour (Légèrement)', '3': 'Sans avis', '2': 'Contre (Légèrement)', '1': 'Contre (Fortement)'};

        // Ajouter les lignes pour chaque étoile (de 5 à 1)
        for (let stars = 5; stars >= 1; stars--) {
            const row = document.createElement('tr');

            // Colonne des étoiles
            const starsCell = document.createElement('td');
            starsCell.textContent = libelles[stars];
            starsCell.style.padding = '6px';
            starsCell.style.border = '1px solid #ccc';
            row.appendChild(starsCell);

            // Colonne du nombre d'avis
            const reviewsCell = document.createElement('td');
            reviewsCell.textContent = ratingsData[stars].toLocaleString();
            reviewsCell.style.padding = '5px';
            reviewsCell.style.border = '1px solid #ccc';
            reviewsCell.style.textAlign = 'right';
            row.appendChild(reviewsCell);

            tbody.appendChild(row);
        }

        // Ajouter une ligne pour le total
        const totalRow = document.createElement('tr');
        totalRow.style.fontWeight = 'bold';
        totalRow.style.backgroundColor = '#f2f2f2';

        const totalLabelCell = document.createElement('td');
        totalLabelCell.textContent = 'Total';
        totalLabelCell.style.padding = '5px';
        totalLabelCell.style.border = '1px solid #ccc';
        totalRow.appendChild(totalLabelCell);

        const totalValueCell = document.createElement('td');
        totalValueCell.textContent = totalReviews.toLocaleString();
        totalValueCell.style.padding = '5px';
        totalValueCell.style.border = '1px solid #ccc';
        totalValueCell.style.textAlign = 'right';
        totalRow.appendChild(totalValueCell);

        tbody.appendChild(totalRow);
        table.appendChild(tbody);

        // Créer un conteneur pour les boutons en bas
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.justifyContent = 'space-between';
        buttonsContainer.style.marginTop = '10px';
        buttonsContainer.style.gap = '5px'; // Espace entre les boutons

        // Créer le bouton d'export d'image
        const exportButton = document.createElement('button');
        exportButton.textContent = 'Exporter en PNG';
        exportButton.style.padding = '6px 10px';
        exportButton.style.backgroundColor = '#4CAF50';
        exportButton.style.color = 'white';
        exportButton.style.border = 'none';
        exportButton.style.borderRadius = '4px';
        exportButton.style.cursor = 'pointer';
        exportButton.style.fontSize = '12px';
        exportButton.style.fontWeight = 'bold';
        exportButton.style.flex = '1'; // Prend la moitié de l'espace disponible
        exportButton.onclick = function() {
            // Exporter l'image sans modifier l'original
            exportAsImage(container);
        };

        // Créer le bouton de crowdfunding
        const crowdfundingButton = document.createElement('button');
        crowdfundingButton.textContent = 'Soutenir';
        crowdfundingButton.style.padding = '6px 10px';
        crowdfundingButton.style.backgroundColor = '#FF9800'; // Couleur orange pour distinction
        crowdfundingButton.style.color = 'white';
        crowdfundingButton.style.border = 'none';
        crowdfundingButton.style.borderRadius = '4px';
        crowdfundingButton.style.cursor = 'pointer';
        crowdfundingButton.style.fontSize = '12px';
        crowdfundingButton.style.fontWeight = 'bold';
        crowdfundingButton.style.flex = '1'; // Prend la moitié de l'espace disponible
        crowdfundingButton.onclick = function() {
            window.open('https://buy.stripe.com/aEUeWy74mgRwc2Q8wB', '_blank');
        };

        // Ajouter les boutons au conteneur
        buttonsContainer.appendChild(exportButton);
        buttonsContainer.appendChild(crowdfundingButton);

        // Ajouter les contenus au conteneur d'onglets
        tabContents.appendChild(donutChart);
        tabContents.appendChild(table);

        // Gérer le changement d'onglet
        chartTab.addEventListener('click', function() {
            // Activer l'onglet graphique
            chartTab.style.fontWeight = 'bold';
            chartTab.style.backgroundColor = '#f0f0f0';
            tableTab.style.fontWeight = 'normal';
            tableTab.style.backgroundColor = 'transparent';

            // Afficher le graphique, cacher le tableau
            donutChart.style.display = 'block';
            table.style.display = 'none';
        });

        tableTab.addEventListener('click', function() {
            // Activer l'onglet tableau
            tableTab.style.fontWeight = 'bold';
            tableTab.style.backgroundColor = '#f0f0f0';
            chartTab.style.fontWeight = 'normal';
            chartTab.style.backgroundColor = 'transparent';

            // Afficher le tableau, cacher le graphique
            table.style.display = 'table';
            donutChart.style.display = 'none';
        });

        // Assembler tous les éléments
        container.appendChild(closeButton);
        container.appendChild(titleContainer);
        container.appendChild(rateDiv);
        container.appendChild(tabsContainer);
        container.appendChild(tabContents);
        container.appendChild(buttonsContainer);

        // Ajouter au corps du document
        document.body.appendChild(container);
    }

    // Fonction principale pour exécuter le script
    function main() {
        // Attendre que la page soit complètement chargée
        setTimeout(() => {
            // Extraire les données des avis
            const ratingsData = extractRatingsInfo();

            // Vérifier si des données ont été trouvées
            const totalReviews = Object.values(ratingsData).reduce((acc, val) => acc + val, 0);
            console.log("Total des avis trouvés:", totalReviews);

            // Chercher également avec une autre méthode si aucun avis n'a été trouvé
            if (totalReviews === 0) {
                console.log("Aucun avis trouvé avec la méthode principale, essai avec une méthode alternative...");
                // Rechercher le texte brut dans le document
                const documentText = document.body.innerText;
                const allMatches = documentText.match(/\d+\s*étoiles?[,\s]+\d+\s*avis/gi);
                if (allMatches) {
                    console.log("Matches trouvés dans le texte:", allMatches);
                }
            }

            // Récupérer les informations sur le lieu
            const placeInfo = findPlaceInfo();
            console.log("Nom du lieu utilisé pour le titre:", placeInfo.name);

            // Créer le tableau des avis
            createRatingsTable(ratingsData, placeInfo.name);
        }, 3000);
    }

    // N'exécuter que si l'URL contient maps
    if (window.location.href.toLowerCase().includes('maps')) {
        // Récupérer les informations sur le lieu pour positionner le bouton
        const placeInfo = findPlaceInfo();

        // Créer et positionner le bouton d'analyse
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Convertir en Vote Nuancé';
        refreshButton.style.zIndex = '9999';
        refreshButton.style.padding = '8px 12px';
        refreshButton.style.backgroundColor = '#00a8ff';
        refreshButton.style.color = 'white';
        refreshButton.style.border = 'none';
        refreshButton.style.borderRadius = '5px';
        refreshButton.style.cursor = 'pointer';
        refreshButton.style.fontSize = '12px';
        refreshButton.style.fontWeight = 'bold';
        refreshButton.style.boxShadow = '0 0 5px rgba(0,0,0)';

        if (placeInfo.element) {
            // Positionner le bouton relativement au bouton "Avis" trouvé
            console.log("Positionnement du bouton relativement à l'élément trouvé");

            // Obtenir la position de l'élément parent pour positionner le bouton
            const tabContainer = placeInfo.element.parentElement;
            if (tabContainer) {
                // Ajouter le bouton après le conteneur des onglets
                tabContainer.parentNode.insertBefore(refreshButton, tabContainer.nextSibling);
                refreshButton.style.margin = '10px';
                refreshButton.style.display = 'block';
            } else {
                // Si pas de parent, ajouter le bouton à proximité
                document.body.appendChild(refreshButton);

                // Positionner à côté de l'élément trouvé
                const rect = placeInfo.element.getBoundingClientRect();
                refreshButton.style.position = 'absolute';
                refreshButton.style.top = (rect.bottom + window.scrollY + 10) + 'px';
                refreshButton.style.left = (rect.left + window.scrollX) + 'px';
            }
        } else {
            // Si aucun élément n'est trouvé, positionner en bas à droite (comportement précédent)
            console.log("Positionnement du bouton en bas à droite (par défaut)");
            refreshButton.style.position = 'fixed';
            refreshButton.style.bottom = '20px';
            refreshButton.style.left = '20px';
            document.body.appendChild(refreshButton);
        }

        // Définir le comportement du bouton
        refreshButton.onclick = function() {
            // Supprimer l'ancien conteneur s'il existe
            const oldContainer = document.getElementById('ratings-container');
            if (oldContainer) {
                document.body.removeChild(oldContainer);
            }
            // Exécuter l'analyse
            main();
        };

        // Exécuter le script
        main();
    }
})();