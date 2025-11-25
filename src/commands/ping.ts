import { Command, type CommandInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';

export default class PingCommand extends Command {
    name = 'ping';
    description = 'Replies with Pong! Shows bot latency.';

    async run(interaction: CommandInteraction) {
        const startTime = Date.now();
        await interaction.reply({ content: 'Pinging...' });
        const roundtrip = Date.now() - startTime;
        
        // Get websocket ping from client if available
        let websocketPing = 0;
        if ('client' in interaction && interaction.client && 'ws' in interaction.client && interaction.client.ws && typeof interaction.client.ws === 'object' && 'ping' in interaction.client.ws && typeof interaction.client.ws.ping === 'number') {
            websocketPing = interaction.client.ws.ping;
        }

        const pingEmbed = new Embed({
            color: 0x5865F2,
            title: '🏓 Pong!',
            fields: [
                { name: 'Roundtrip Latency', value: `${roundtrip}ms`, inline: true },
                { name: 'Websocket Ping', value: `${websocketPing}ms`, inline: true }
            ],
            timestamp: new Date().toISOString()
        });

        await interaction.followUp({ content: '', embeds: [pingEmbed] });
    }
}

