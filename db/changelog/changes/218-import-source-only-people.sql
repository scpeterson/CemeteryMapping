--liquibase formatted sql

--changeset cemeterymapping:218-import-source-only-people
WITH trinity AS (
  SELECT id
  FROM cemeteries
  WHERE facility_id = '1'
     OR name = 'Trinity Lutheran Church Cemetery'
  ORDER BY facility_id = '1' DESC, name
  LIMIT 1
),
records(full_name, source_code, raw_text) AS (
  VALUES
    ($nhg$Baier, Heinrich$nhg$, 'CRG', $nhg$Baier, Heinrich, son of Philipp Baier and his wife Maria nee Noss, b. 5 October 1878, f. March 7, 1890, d. 5 March, 11y 5m (CRG)$nhg$),
    ($nhg$Baier, Marie$nhg$, 'CRG', $nhg$Baier, Marie nee Nas, b. Wolf, Hessia Darmstadt, Germany August 22, 1893, d. 27th March 1899, buried 29th March, age 60y 7m 7da (CRG)$nhg$),
    ($nhg$Baier, Philipp$nhg$, 'CRG', $nhg$Baier, Philipp, Pferdsbach Hessen-Darmstadt, f. June 25, 1880, d. June 23, 48y (CRG)$nhg$),
    ($nhg$Beyer, Maria$nhg$, 'CRG', $nhg$Beyer, Maria, young daughter of Philip & Maria, f. February 18, 1876, d. 16 February, 9m, less than 2 da (CRG)$nhg$),
    ($nhg$Baklarz, Lillian$nhg$, 'CR', $nhg$Baklarz, Lillian, April 4, 1903 - Nov. 22, 1985$nhg$),
    ($nhg$Beierlein, Wolfgang$nhg$, 'CRG', $nhg$Beierlein, Wolfgang, b. 24 June 1816 near near Bayreuth, Oberfranken, d. 24 December 1895 in Beaver County Pa., 79y 6m, buried 26 December in the churchyard of Ottos-Church, Beaver Co., Pa. (CRG)$nhg$),
    ($nhg$Berger, George$nhg$, 'CRG', $nhg$Berger, George, b. 22 March 1827 in Zoveren Kurhessen, d. 7 April, f. April 8, 1879 (CRG)$nhg$),
    ($nhg$Beringer, Albert John$nhg$, 'CR', $nhg$Beringer, Albert John, d. January 3, 1965, 79y 1m 13da$nhg$),
    ($nhg$Beyer, Catharine$nhg$, 'CRG', $nhg$Beyer, Catharine nee Hinkel, wife of Conrad Beyer, f. April 10, 1867, d. 8 April at 1: 30 pm, 83y (CRG)$nhg$),
    ($nhg$Beyer, Charlotte$nhg$, 'CRG', $nhg$Beyer, Charlotte nee Grasmucke, f. September 21, 1885, d. 20 September, b. 17 August 1811 in Dudenuth in Hessen Darmstadt, 74y 1m 3da (CRG)$nhg$),
    ($nhg$Beyer, little son$nhg$, 'CRG', $nhg$Beyer, little son of Philip & Maria, f. December 27, 1865, d. 24 December (CRG)$nhg$),
    ($nhg$Bloedel, Anton Carl$nhg$, 'CRG', $nhg$Bloedel, Anton Carl, little son of Heinrich Christian & his wife Josephine Catharine nee Meyer, f. August 2, 1874, d. 1 August, 10m 24da (CRG)$nhg$),
    ($nhg$Brandt, John D.$nhg$, 'CR', $nhg$Brandt, John D., d. May 18, 1948, 71y 1m 8da$nhg$),
    ($nhg$Brant, Albert$nhg$, 'CRG', $nhg$Brant, Albert, little son of George & Anna Margarethe, f. September 14, 1868, d. 13 September, 11da (CRG)$nhg$),
    ($nhg$Breidenbach, Michael$nhg$, 'CRG', $nhg$Breidenbach, Michael from Bartenstein, Bavaria, b. 15 September 1812, f. June 3, 1882, d. 1 June in Sharpsburg Pa. (CRG)$nhg$),
    ($nhg$Broerman, Adolph I.$nhg$, 'CR', $nhg$Broerman, Adolph I., d. February 16, 1956, 72y 26da$nhg$),
    ($nhg$Broerman, George$nhg$, 'CR', $nhg$Broerman, George, d. Aprll 22, 1919, 73y$nhg$),
    ($nhg$Broerman, Jacob George$nhg$, 'CR', $nhg$Broerman, Jacob George, d. March 11, 1947, 65y 8m 14da$nhg$),
    ($nhg$Broerman, John$nhg$, 'CR', $nhg$Broerman, John, d. October 29, 1951, 72y 1m 21da$nhg$),
    ($nhg$Broerman, Margaret Anna$nhg$, 'CR', $nhg$Broerman, Margaret Anna, d. March 2, 1931, 30y 6m 29da$nhg$),
    ($nhg$Broerman, Nora$nhg$, 'CR', $nhg$Broerman, Nora, d. Dec. 7, 1992, 37y$nhg$),
    ($nhg$Broermann, Johann Willbrand$nhg$, 'CRG', $nhg$Broermann, Johann Willbrand, b Schagen In Hannover, f. January 24, 1868, d. 22 January, 61y 6m 8da (CRG)$nhg$),
    ($nhg$Broermann, M. Margaretha Elisabeth$nhg$, 'CRG', $nhg$Broermann, M. Margaretha Elisabeth from Schagen Ry. Hannover, b. 20 May 1810, f. March 19, 1885, d. March 17, 74y 9m 27da (CRG)$nhg$),
    ($nhg$Broermman, Mrs. John Geisler$nhg$, 'CR', $nhg$Broermman, Mrs. John Geisler, d. May 29, 1909, 28y$nhg$),
    ($nhg$Capenos, Augusta$nhg$, 'CR', $nhg$Capenos, Augusta, d. March 29, 1943, 61 y$nhg$),
    ($nhg$Capenos, Charles$nhg$, 'CR', $nhg$Capenos, Charles, d. June 25, 1937, 59y$nhg$),
    ($nhg$Capenos, Ruth Ida$nhg$, 'CR', $nhg$Capenos, Ruth Ida, d. May 29, 1951, 37y 7m 5da$nhg$),
    ($nhg$Deimllng, Anna Marla Elisabeth$nhg$, 'CRG', $nhg$Deimllng, Anna Marla Elisabeth, daughter of Georg Valentin & Verena nee Wilt In West View, f. February 28, 1885, d. 26 February, b. 2(?)th October 1873, 11y 4m 1da (CRG)$nhg$),
    ($nhg$Dent, Mrs. Annie Daykin$nhg$, 'CR', $nhg$Dent, Mrs. Annie Daykin, d. January 4, 1950, 81y 6m 11da$nhg$),
    ($nhg$Dietrich, Iwan Alexander$nhg$, 'CRG', $nhg$Dietrich, Iwan Alexander, little son of Iwan & Caroline nee Alboen, f. December 26, 1887, d. 23 December (CRG)$nhg$),
    ($nhg$Dunkle, D. M.$nhg$, 'CR', $nhg$Dunkle, D. M., d. October, 1945, 82y 1m 25d$nhg$),
    ($nhg$Galleper, Timothy Daniel$nhg$, 'CR', $nhg$Galleper, Timothy Daniel, d. September 14, 1948, 3y 3da$nhg$),
    ($nhg$Graf, Emma Katharine$nhg$, 'CRG', $nhg$Graf, Emma Katharine, daughter of Adam & Maria, f. 22 Feb. 1881. Balance Is illegible. (CRG)$nhg$),
    ($nhg$Graham, Nisley Broerman$nhg$, 'CR', $nhg$Graham, Nisley Broerman, d. September 26, 1930, 2y$nhg$),
    ($nhg$Graham, Stanley$nhg$, 'CR', $nhg$Graham, Stanley, d. June 17, 1932$nhg$),
    ($nhg$Hague, Ryan Lewis$nhg$, 'CR', $nhg$Hague, Ryan Lewis, d. December 30, 1958, 2da, child of Louis and Harriet Hague$nhg$),
    ($nhg$Heckert, little son$nhg$, 'CRG', $nhg$Heckert, little son of William Heckert and his wife Elisabeth nee Cairns, 1877 (CRG)$nhg$),
    ($nhg$Hennl, Rosina$nhg$, 'CRG', $nhg$Hennl, Rosina nee Luther from the Canton Solothurn Switzerland b. 4 June 1839, f. October 24, 1883, d. 22 October, 44y 4m 17da (CRG)$nhg$),
    ($nhg$Hild, Heinrich$nhg$, 'CRG', $nhg$Hild, Heinrich, son of George & Barbara, f. April 29, 1866, d. 25 April, 15y 5m 16da (CRG)$nhg$),
    ($nhg$Hild, Margaretha Elisabeth$nhg$, 'CRG', $nhg$Hild, Margaretha Elisabeth, b. 9 November 1793 in Hessen Damistadtlchen near Frankfurt am Main, f. February 8, 1877, d. 6 February at 9:30 am, 83y 90da (CRG)$nhg$),
    ($nhg$Hild, Phillip$nhg$, 'CRG', $nhg$Hild, Phillip, f. August 8, 1871, d. 6 August, age 79 y 5 m 20 d. Left behind, 3 children, 23 grandchildren, &. 2 great-grandchildren (CRG)$nhg$),
    ($nhg$Hild, Phillip$nhg$, 'CRG', $nhg$Hild, Phillip, son of George & Barbara, f. April 21, 1869, d. In Pittsburgh 19 April at 3 am, 20y 1m 15da (CRG)$nhg$),
    ($nhg$K[-], Emma R.$nhg$, 'CRG', $nhg$K[-], Emma R., f. February 22, 1801 (CRG)$nhg$),
    ($nhg$Keller, Verena Marfa May$nhg$, 'CRG', $nhg$Keller, Verena Marfa May, little daughter of John &. Christina Keller nee Wilt, b. 27 April 1878, f. February 18, 1879, d. February 16 in the morning, age (?) 10m (CRG)$nhg$),
    ($nhg$King, Baby Boy$nhg$, 'CR', $nhg$King, Baby Boy, d. December 11, 1952, 1da$nhg$),
    ($nhg$Klette, Christoph Heinrich$nhg$, 'CRG', $nhg$Klette, Christoph Heinrich b Moxa, Kreis Ziegenröck, f. November 24, 1868, d. 22 November, 65y 11da (CRG)$nhg$),
    ($nhg$Kletter, Albert Johann$nhg$, 'CRG', $nhg$Kletter, Albert Johann, son of Heinrich & Barbara nee Sorgel, f. July 18, 1881, d. 17 July (CRG)$nhg$),
    ($nhg$Kletter, Johanna Elisabeth$nhg$, 'CRG', $nhg$Kletter, Johanna, Elisabeth, b. March 1, 1811 in Raniss, Province Saxony, f. March 14, 1878, d. 12 March near midnight, 67y 12da (CRG)$nhg$),
    ($nhg$Kletter, Philipp Eduard$nhg$, 'CRG', $nhg$Kletter, Philipp Eduard, little son of Friedrich H. & wife Kunlgunde Barbara nee Soergel, f. March 9, 1887, d. 7 March (CRG)$nhg$),
    ($nhg$Knobeloch, Bettie Christine$nhg$, 'CR', $nhg$Knobeloch, Bettie Christine, d. August 8, 1944, 2 weeks$nhg$),
    ($nhg$Knobloch, Charles$nhg$, 'CR', $nhg$Knobloch, Charles, d. November 17, 1915, 80y Note: See Carl C. page 213$nhg$),
    ($nhg$Koenig, Heinrich$nhg$, 'CRG', $nhg$Koenig, Heinrich, b. 16 March 1839 in East Liberty, f. September 7, 1884, d. 5 September, 45y 5m 21da (CRG)$nhg$),
    ($nhg$Krepps, Mildred M.$nhg$, 'CR', $nhg$Krepps, Mildred M., Mar. 6, 1910 - Jan. 10, 1996$nhg$),
    ($nhg$Kummer, Anna Katherine$nhg$, 'CR', $nhg$Kummer, Anna Katherine, d. October 16, 1939, 81+y$nhg$),
    ($nhg$Lehr, August$nhg$, 'CR', $nhg$Lehr, August, d. December 2, 1937, 81y$nhg$),
    ($nhg$Lloyd, Nora (Steele)$nhg$, 'CR', $nhg$Lloyd, Nora (Steele), d. May 3, 1960, 60y 4m 2da, "childhood In Trinity"$nhg$),
    ($nhg$Mashey, Elizabeth$nhg$, 'CR', $nhg$Mashey, Elizabeth, d. November 8, 1936, 66y$nhg$),
    ($nhg$Meyer, Anna Ellsabetha$nhg$, 'CRG', $nhg$Meyer, Anna Ellsabetha, b. 18 October 1824 Lich Bas Giesen, d. 3 January 1894, 69y 2m 16da (CRG)$nhg$),
    ($nhg$Meyer, Ludwig$nhg$, 'CRG', $nhg$Meyer, Ludwig, son of Phil. & Anna Elizabeth nee Klohs, f. July 15, 1874, d. 13 July, 26y 6m 6da (CRG)$nhg$),
    ($nhg$Moerllch, Mrs. John$nhg$, 'CR', $nhg$Moerllch, Mrs. John, d. August 20. 1910, 76y$nhg$),
    ($nhg$Nichols, Celia Odessa$nhg$, 'CR', $nhg$Nichols, Celia Odessa, d. July 25, 1938, 53y$nhg$),
    ($nhg$Pegher, Carol H.$nhg$, 'CR', $nhg$Pegher, Carol H., Obt. 13, 1952 - Nov. 3, 2002$nhg$),
    ($nhg$Pegher, Simon Wilbert$nhg$, 'CR', $nhg$Pegher, Simon Wilbert, d. about November 1, 1949, 49y 11m 20da$nhg$),
    ($nhg$Purucker, Catharina$nhg$, 'CRG', $nhg$Purucker, Catharina nee Klehlman, b. 15 July 1833 in Oberfranken Bavaria, Germany, d. August 24, 1898 in Franklin T. Allegheny Co. Pa., buried August 26th in Fairmont Cemetery, Allegheny Pa., 65y 1m 8da (CRG)$nhg$),
    ($nhg$Rice, John Franklin$nhg$, 'CR', $nhg$Rice, John Franklin, d. October 8, 1947, 79y 4m 16da$nhg$),
    ($nhg$Sarver, Emma Edith$nhg$, 'CR', $nhg$Sarver, Emma Edith, d. April 14, 1978, 86y 11m 10da$nhg$),
    ($nhg$Sarver, little daughter$nhg$, 'CRG', $nhg$Sarver, little daughter of James & Esther, b. & d. 5 March 1877, f. March 6 (CRG)$nhg$),
    ($nhg$Scharf, Edna Dora$nhg$, 'CR', $nhg$Scharf, Edna Dora, d. December 30, 1928, 1y 3m 29da$nhg$),
    ($nhg$Scharf, Pearl Ruby$nhg$, 'CR', $nhg$Scharf, Pearl Ruby, d, July 16, 1937, 2y$nhg$),
    ($nhg$Scharr, Johann$nhg$, 'CRG', $nhg$Scharr, Johann, little son of Johann & Catharina, f. January 8, 1875, d, 7 January, 6m 23da (CRG)$nhg$),
    ($nhg$Scharr, Maria Catharina$nhg$, 'CRG', $nhg$Scharr, Maria Catharina, young daughter of Johann & Catharina, f. January 5, 1875, d. 4 January, 5y 7m 8da (CRG)$nhg$),
    ($nhg$Seek, Alfred Williams$nhg$, 'CR', $nhg$Seek, Alfred Williams, d. July 3, 1917, 40da$nhg$),
    ($nhg$Soergel, Infant$nhg$, 'CR', $nhg$Soergel, Infant, d. June 3, 1916, 1da, son of Philip Soergel$nhg$),
    ($nhg$Soergel, John E.$nhg$, 'CR', $nhg$Soergel, John E., d. November 30, 1910, 58y$nhg$),
    ($nhg$Srokler, little son$nhg$, 'CRG', $nhg$Srokler, little son of Albrecht & Christina Srokler, b. 16 March 1877, f. April 25, 1877, d. 23 April, age 6 weeks, 4da. His mother gave him emergency baptism. (CRG)$nhg$),
    ($nhg$Steele, Simon$nhg$, 'CR', $nhg$Steele, Simon, d. February 28, 1940$nhg$),
    ($nhg$Stevens, Rudie S.$nhg$, 'CR', $nhg$Stevens, Rudie S. d. January 24, 1956, 79y 19da$nhg$),
    ($nhg$Übersax, Johann Jacob$nhg$, 'CRG', $nhg$Übersax, Johann Jacob, b May 20, 1803 in Doriyen Canton Bern Switzerland, f. December 7, 1874, d. 5 December, 71y (CRG)$nhg$),
    ($nhg$Ubersax, Samuel$nhg$, 'CR', $nhg$Ubersax, Samuel, d. March 22, 1919, 77y$nhg$),
    ($nhg$Uebersax, Catharine$nhg$, 'CRG', $nhg$Uebersax, Catharine nee Lang from Hutwyl, Canton Bern, (Switzerland), b. 1812, f. April 28, 1884, d. 26 April, 72y (CRG)$nhg$),
    ($nhg$Uebersorg, Barbara$nhg$, 'CRG', $nhg$Uebersorg, Barbara, f. August 31, 1891, d. 30 August, age [-] (CRG)$nhg$),
    ($nhg$Walters, Baby Boy$nhg$, 'CR', $nhg$Walters, Baby Boy, d. December 27, 1955, stillborn$nhg$),
    ($nhg$Watenpool, Gerald W.$nhg$, 'CR', $nhg$Watenpool, Gerald W., Oct. 28, 1912 - Oct. 2, 1988$nhg$),
    ($nhg$Wibinger, little son$nhg$, 'CRG', $nhg$Wibinger, little son of Christian & Louise nee Miller, b. 12 March 1880 in Franklin Township, Allegheny Co., Pa, f. April 14, 1880. d. April 13 in morning (CRG)$nhg$),
    ($nhg$Will, Frau Christine Elisabeth$nhg$, 'CRG', $nhg$Will, Frau Christine Elisabeth, born Gross, from Fischbach in Rhein Luzann, d. 4 February, 60y 7m 10da, f. February 6, 1868 (CRG)$nhg$),
    ($nhg$Will, Wilhelm Georg$nhg$, 'CRG', $nhg$Will, Wilhelm Georg, small son of Jacob & his wife Maria nee Powers, f. January 9, 1872, d. 7 January, 5y 3m (CRG)$nhg$),
    ($nhg$Wilt, Georg Heinrich$nhg$, 'CRG', $nhg$Wilt, Georg Heinrich, son of Heinrich & Marie nee Knuedler, f. May 21, 1885, d. 19 May, b. 8 February 1881, 4y 3m 11da (CRG)$nhg$),
    ($nhg$Wilt, Jacob$nhg$, 'CRG', $nhg$Wilt, Jacob, b. 14 September 1815 In the Canton Gilarus Switzerland, f. October 14, 1884, d. 12 October in Ross Twp. Allegheny Co. Pa., 69y 28da (CRG)$nhg$),
    ($nhg$Wlskeman, Walter, Jr.$nhg$, 'CR', $nhg$Wlskeman, Walter, Jr., d. May 13, 1931, 9y$nhg$),
    ($nhg$Wlskeman, William$nhg$, 'CR', $nhg$Wlskeman, William, d. January 15, 1942, 68y$nhg$),
    ($nhg$Wübinger, George Christian$nhg$, 'CRG', $nhg$Wübinger, George Christian, son of Johann Christian & Louise Margareta (Miller), f. January 20, 1882, d. 18 January (CRG)$nhg$),
    ($nhg$Ziegenthaler, Catharine$nhg$, 'CRG', $nhg$Ziegenthaler, Catharine, daughter of Georg & Catharine, f. July 2, 1871, d. 30 June, 15y (?) (CRG)$nhg$),
    ($nhg$Ziegenthaler, Vina$nhg$, 'CRG', $nhg$Ziegenthaler, Vina, daughter of Georg & Catharina, f. May 3, 1875, d. 1 May, 8y 7m 7da (CRG)$nhg$)
)
INSERT INTO source_person_records (
  cemetery_id,
  source_name,
  source_code,
  source_label,
  source_location_text,
  record_type,
  status,
  confidence,
  full_name,
  raw_text,
  notes
)
SELECT
  trinity.id,
  'North Hills Genealogists Trinity OCR',
  records.source_code,
  'NHG source-only church record',
  'NHG church records with no matching tombstone, pages 233-236',
  'death_record',
  'unmatched',
  'high',
  records.full_name,
  records.raw_text,
  'Imported from NHG source-only church records; NHG documented no matching tombstone for these names.'
FROM records
CROSS JOIN trinity
WHERE NOT EXISTS (
  SELECT 1
  FROM source_person_records existing
  WHERE existing.cemetery_id = trinity.id
    AND existing.full_name = records.full_name
    AND existing.raw_text = records.raw_text
    AND existing.deleted_at IS NULL
);

--rollback WITH trinity AS (SELECT id FROM cemeteries WHERE facility_id = '1' OR name = 'Trinity Lutheran Church Cemetery' ORDER BY facility_id = '1' DESC, name LIMIT 1) DELETE FROM source_person_records USING trinity WHERE source_person_records.cemetery_id = trinity.id AND source_person_records.source_label = 'NHG source-only church record' AND source_person_records.source_location_text = 'NHG church records with no matching tombstone, pages 233-236';
