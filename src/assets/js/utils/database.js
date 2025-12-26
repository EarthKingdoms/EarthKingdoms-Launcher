/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { NodeBDD, DataType } = require('node-bdd');
const nodedatabase = new NodeBDD()
const { ipcRenderer } = require('electron')

let dev = process.env.NODE_ENV === 'dev';

// Cache pour stocker les instances de tables initialisées
const tableCache = new Map();

class database {
    async creatDatabase(tableName, tableConfig) {
        // Utiliser un cache pour éviter de réinitialiser la table à chaque fois
        const cacheKey = `${tableName}_${dev ? 'dev' : 'prod'}`;
        
        if (tableCache.has(cacheKey)) {
            return tableCache.get(cacheKey);
        }
        
        const userDataPath = await ipcRenderer.invoke('path-user-data');
        // Utiliser EXACTEMENT la même logique que la version 2.1.6 (concaténation de chaîne)
        // node-bdd semble préférer cette approche
        const dbPath = `${userDataPath}${dev ? '../..' : '/databases'}`;
        
        const table = await nodedatabase.intilize({
            databaseName: 'Databases',
            fileType: dev ? 'sqlite' : 'db',
            tableName: tableName,
            path: dbPath,
            tableColumns: tableConfig,
        });
        
        // Mettre en cache l'instance de table
        tableCache.set(cacheKey, table);
        
        return table;
    }

    async getDatabase(tableName) {
        return await this.creatDatabase(tableName, {
            json_data: DataType.TEXT.TEXT,
        });
    }

    async createData(tableName, data) {
        let table = await this.getDatabase(tableName);
        const result = await nodedatabase.createData(table, { json_data: JSON.stringify(data) })
        let id = result.id
        const parsedData = JSON.parse(result.json_data)
        parsedData.ID = id
        
        
        return parsedData
    }

    async readData(tableName, key = 1) {
        let table = await this.getDatabase(tableName);
        let data = await nodedatabase.getDataById(table, key)
        if(data) {
            let id = data.id
            data = JSON.parse(data.json_data)
            data.ID = id
        }
        return data ? data : undefined
    }

    async readAllData(tableName) {
        let table = await this.getDatabase(tableName);
        let data = await nodedatabase.getAllData(table)
        return data.map(info => {
            let id = info.id
            info = JSON.parse(info.json_data)
            info.ID = id
            return info
        })
    }

    async updateData(tableName, data, key = 1) {
        let table = await this.getDatabase(tableName);
        await nodedatabase.updateData(table, { json_data: JSON.stringify(data) }, key)
    }

    async deleteData(tableName, key = 1) {
        let table = await this.getDatabase(tableName);
        await nodedatabase.deleteData(table, key)
    }
}

export default database;
